-- One-click connect (docs/mcp-workflows.md, design: docs/superpowers/specs/2026-11-19-mcp-elite-design.md).
-- A member adds Brazework to Claude, Cursor or VS Code and signs in, instead of pasting a token. Supabase
-- Auth's OAuth 2.1 server signs them in and asks their consent (/oauth/consent in the app); the assistant
-- then calls /api/mcp with the access token. Run after mcp-workflows.sql. Additive.
--
-- Every MCP tool checks a token hash (supabase/mcp.sql), so each sign-in becomes a token row of its own:
-- one per member, assistant app and sign-in session. The app makes the row's hash with a server-only
-- key (lib/mcp-oauth.ts), so it can't be worked out from outside, and the row works like any token:
-- it starts reading and drafting, "Can post" turns on posting, and revoking it in Settings → Your tools
-- stops that sign-in at once. Signing in again from the assistant makes a new row and closes the old one.

alter table public.api_tokens add column if not exists oauth_client text
  check (oauth_client is null or oauth_client ~ '^[A-Za-z0-9-]{1,64}$');
grant select (oauth_client) on public.api_tokens to authenticated;

-- The name the member saw on the consent page ("Claude"), so Settings can say which app it is.
create table if not exists public.mcp_oauth_apps (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id text not null check (client_id ~ '^[A-Za-z0-9-]{1,64}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60 and name !~ '[<>]'),
  approved_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.mcp_oauth_apps enable row level security;
drop policy if exists "own apps: read" on public.mcp_oauth_apps;
create policy "own apps: read" on public.mcp_oauth_apps for select to authenticated using (user_id = auth.uid());
revoke all on public.mcp_oauth_apps from anon, authenticated;
grant select on public.mcp_oauth_apps to authenticated;

-- Called by the consent page when the member approves an app.
create or replace function public.remember_oauth_app(p_client text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  insert into public.mcp_oauth_apps (user_id, client_id, name)
  values (auth.uid(), p_client, left(regexp_replace(btrim(coalesce(nullif(p_name, ''), 'AI assistant')), '[<>]', '', 'g'), 60))
  on conflict (user_id, client_id) do update set name = excluded.name, approved_at = now();
end $$;

-- The token row for this sign-in, made on its first call. Runs as the member: the caller passes the
-- OAuth access token, so auth.uid() and the token's client_id are theirs, not something a caller can
-- claim. Returns the row's scopes, or null when the member revoked this sign-in in Settings.
create or replace function public.mcp_oauth_link(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  client text := auth.jwt() ->> 'client_id';
  t public.api_tokens;
  label text;
begin
  if me is null or client is null or client !~ '^[A-Za-z0-9-]{1,64}$' then raise exception 'Sign in from your assistant again.' using errcode = '42501'; end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'That sign-in isn''t valid.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'Finish setting up your Brazework account first.' using errcode = 'P0001'; end if;
  select * into t from public.api_tokens where token_hash = p_hash;
  if t.id is not null then
    if t.user_id <> me then raise exception 'That sign-in isn''t yours.' using errcode = '42501'; end if;
    if t.revoked_at is not null then return null; end if;
    return jsonb_build_object('scopes', to_jsonb(t.scopes));
  end if;
  -- A new sign-in from the same app replaces the one before it.
  update public.api_tokens set revoked_at = now() where user_id = me and oauth_client = client and revoked_at is null;
  label := coalesce((select name from public.mcp_oauth_apps where user_id = me and client_id = client), 'AI assistant');
  insert into public.api_tokens (user_id, name, token_hash, prefix, scopes, oauth_client)
  values (me, left(label || ' (signed in)', 60), p_hash, 'forge_oauth', array['read', 'draft'], client)
  returning * into t;
  return jsonb_build_object('scopes', to_jsonb(t.scopes));
end $$;

create or replace function public.mcp_oauth_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.remember_oauth_app(text, text), public.mcp_oauth_link(text) from anon, public;
grant execute on function public.remember_oauth_app(text, text), public.mcp_oauth_link(text), public.mcp_oauth_ready() to authenticated;
