-- Approve in chat (docs/mcp-workflows.md). Run after mcp-oauth.sql and mcp-workflows.sql. Additive.
--
-- On the consent page the member now picks how a connected assistant adds things:
--   * "When I say yes in chat" (the default): the sign-in gets read + post. The assistant shows what
--     it will add and asks; the member's yes in the chat (and the assistant's own Allow prompt) is the
--     approval, and it lands on their record right away.
--   * "Drafts only": read + draft, as before. Everything waits in Brazework → Drafts.
-- The choice is kept per app (mcp_oauth_apps.can_post), applies at once to that app's open sign-ins,
-- and carries over when the assistant signs in again. "Can post" in Settings → Your tools changes the
-- same choice, so the two never disagree. Scopes match mcp-workflows.sql: read + draft + post, or
-- read + draft.

alter table public.mcp_oauth_apps add column if not exists can_post boolean not null default false;

-- The consent page's answer. The two-argument version (mcp-oauth.sql) stays for an app deployed
-- before this step: it remembers the name and leaves the choice as it was.
create or replace function public.remember_oauth_app(p_client text, p_name text, p_can_post boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if p_client is null or p_client !~ '^[A-Za-z0-9-]{1,64}$' then raise exception 'That app isn''t valid.' using errcode = 'P0001'; end if;
  insert into public.mcp_oauth_apps (user_id, client_id, name, can_post)
  values (auth.uid(), p_client, left(regexp_replace(btrim(coalesce(nullif(p_name, ''), 'AI assistant')), '[<>]', '', 'g'), 60), coalesce(p_can_post, false))
  on conflict (user_id, client_id) do update set name = excluded.name, approved_at = now(), can_post = excluded.can_post;
  update public.api_tokens
  set scopes = case when coalesce(p_can_post, false) then array['read', 'draft', 'post'] else array['read', 'draft'] end
  where user_id = auth.uid() and oauth_client = p_client and revoked_at is null;
end $$;

-- A sign-in's token row (as in mcp-oauth.sql), now starting with the choice the member made for the app.
create or replace function public.mcp_oauth_link(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  client text := auth.jwt() ->> 'client_id';
  t public.api_tokens;
  label text;
  posts boolean;
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
  select name, can_post into label, posts from public.mcp_oauth_apps where user_id = me and client_id = client;
  insert into public.api_tokens (user_id, name, token_hash, prefix, scopes, oauth_client)
  values (me, left(coalesce(label, 'AI assistant') || ' (signed in)', 60), p_hash, 'forge_oauth',
          case when coalesce(posts, false) then array['read', 'draft', 'post'] else array['read', 'draft'] end, client)
  returning * into t;
  return jsonb_build_object('scopes', to_jsonb(t.scopes));
end $$;

-- "Can post" in Settings → Your tools, as in mcp-workflows.sql (off leaves it drafting; a GitHub
-- Actions token never posts). For a signed-in assistant it is also the app's choice, so its next
-- sign-in keeps it.
create or replace function public.set_api_token_post(p_id uuid, p_post boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens;
begin
  update public.api_tokens set scopes = case when p_post then array['read', 'draft', 'post'] else array['read', 'draft'] end
  where id = p_id and user_id = auth.uid() and revoked_at is null and name not ilike 'GitHub Actions%'
  returning * into t;
  if t.id is null then return false; end if;
  if t.oauth_client is not null then
    update public.mcp_oauth_apps set can_post = coalesce(p_post, false) where user_id = t.user_id and client_id = t.oauth_client;
  end if;
  return true;
end $$;

create or replace function public.mcp_oauth_post_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.remember_oauth_app(text, text, boolean), public.mcp_oauth_link(text), public.set_api_token_post(uuid, boolean) from anon, public;
grant execute on function public.remember_oauth_app(text, text, boolean), public.mcp_oauth_link(text), public.set_api_token_post(uuid, boolean), public.mcp_oauth_post_ready() to authenticated;
