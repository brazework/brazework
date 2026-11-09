-- Forge for AI tools (MCP): members create personal tokens in Settings and paste one into Claude,
-- Cursor or any MCP client; /api/mcp answers with read-only tools. Run after profile-extras.sql.
-- Additive.
--
-- Only a SHA-256 hash of each token is stored (the token itself is shown once, in Settings).
-- Every tool is a function here that checks the hash first, then returns only what that member
-- could already see in the app: their own profile, clubs, projects and notifications, public
-- clubs and people, and events from public clubs or clubs they're in. Revoked tokens stop at once.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60 and name !~ '[<>]'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  prefix text not null check (prefix ~ '^forge_[A-Za-z0-9_-]{4,10}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_tokens_user_idx on public.api_tokens (user_id, created_at desc);
alter table public.api_tokens enable row level security;
create policy "own tokens: read" on public.api_tokens for select to authenticated using (user_id = auth.uid());
revoke all on public.api_tokens from anon, authenticated;
grant select (id, name, prefix, created_at, last_used_at, revoked_at) on public.api_tokens to authenticated;

-- Create a token (the app makes the random token and sends only its hash). At most 5 active.
create function public.create_api_token(p_name text, p_hash text, p_prefix text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if (select count(*) from public.api_tokens where user_id = auth.uid() and revoked_at is null) >= 5 then
    raise exception 'You can have up to 5 active tokens. Revoke one first.' using errcode = 'P0001';
  end if;
  insert into public.api_tokens (user_id, name, token_hash, prefix) values (auth.uid(), btrim(p_name), p_hash, p_prefix) returning id into new_id;
  return new_id;
end $$;

create function public.revoke_api_token(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.api_tokens set revoked_at = now() where id = p_id and user_id = auth.uid() and revoked_at is null
$$;

-- Who a token belongs to (null when unknown or revoked). Marks it used, at most once a minute.
create function public.mcp_user(p_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into t from public.api_tokens where token_hash = p_hash and revoked_at is null;
  if t.id is null then return null; end if;
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.api_tokens set last_used_at = now() where id = t.id;
  end if;
  return t.user_id;
end $$;

-- Clubs a member can see: public ones, and ones they belong to.
create function public.mcp_can_view(p_uid uuid, p_cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities where id = p_cid and privacy = 'public')
      or exists (select 1 from public.community_members where community_id = p_cid and uid = p_uid)
$$;

-- The member's profile, at a glance.
create function public.mcp_me(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash); r jsonb;
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  select jsonb_build_object(
    'id', p.id, 'name', btrim(p.first_name || ' ' || p.last_name), 'headline', p.headline, 'field', p.field,
    'interests', p.interests, 'profile_url', '/u/' || p.id,
    'projects', (select count(*) from public.projects where owner_id = me),
    'verified_milestones', (select count(*) from public.milestones where owner_id = me and status = 'verified'),
    'clubs', (select count(*) from public.community_members where uid = me),
    'unread_notifications', (select count(*) from public.notifications where user_id = me and not read))
  into r from public.profiles p where p.id = me;
  return r;
end $$;

create function public.mcp_my_clubs(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', m.role, 'members', c.member_count, 'about', left(c.about, 200), 'url', '/c/' || c.id) order by c.name)
    from public.community_members m join public.communities c on c.id = m.community_id where m.uid = me), '[]');
end $$;

create function public.mcp_events(p_hash text, p_days int default 14) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(x order by x->>'starts_at') from (
    select jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'format', e.format,
             'location', e.location, 'going', e.rsvp_count, 'url', '/events/' || e.id,
             'host', coalesce((select name from public.communities where id = e.community_id), ''),
             'you_are_going', exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = me)) x
      from public.events e
     where e.status = 'published' and e.ends_at > now() and e.starts_at < now() + make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90))
       and (e.community_id is null or public.mcp_can_view(me, e.community_id))
     order by e.starts_at limit 25) s), '[]');
end $$;

create function public.mcp_my_projects(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'summary', p.summary, 'status', p.status, 'private', p.private,
             'url', '/projects/' || p.id,
             'verified_milestones', coalesce((select jsonb_agg(jsonb_build_object('title', m.title, 'club', m.community_name, 'achieved_on', m.achieved_on) order by m.achieved_on desc)
                                      from public.milestones m where m.project_id = p.id and m.status = 'verified'), '[]')) order by p.updated_at desc)
    from public.projects p where p.owner_id = me), '[]');
end $$;

create function public.mcp_search(p_hash text, p_query text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash); q text := '%' || replace(replace(left(btrim(coalesce(p_query, '')), 80), '%', ''), '_', '') || '%';
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  if length(q) < 4 then return jsonb_build_object('clubs', '[]'::jsonb, 'people', '[]'::jsonb); end if;
  return jsonb_build_object(
    'clubs', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'members', c.member_count, 'about', left(c.about, 160), 'url', '/c/' || c.id))
      from (select * from public.communities c where (c.name ilike q or c.about ilike q or c.field ilike q) and public.mcp_can_view(me, c.id) order by c.member_count desc limit 10) c), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', btrim(p.first_name || ' ' || p.last_name), 'headline', p.headline, 'field', p.field, 'url', '/u/' || p.id))
      from (select * from public.profiles p where p.onboarded and p.id <> me and (btrim(p.first_name || ' ' || p.last_name) ilike q or p.headline ilike q or p.field ilike q)
              and not exists (select 1 from public.message_blocks b where (b.blocker = p.id and b.blocked = me) or (b.blocker = me and b.blocked = p.id))
            limit 10) p), '[]'));
end $$;

create function public.mcp_notifications(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'from', btrim(n.actor_first || ' ' || n.actor_last), 'club', nullif(n.community_name, ''),
             'snippet', n.snippet, 'read', n.read, 'at', n.created_at, 'post_url', case when n.post_id is not null then '/post/' || n.post_id end) order by n.created_at desc)
    from (select * from public.notifications where user_id = me order by created_at desc limit 20) n), '[]');
end $$;

revoke execute on function public.create_api_token(text, text, text), public.revoke_api_token(uuid) from anon, public;
grant execute on function public.create_api_token(text, text, text), public.revoke_api_token(uuid) to authenticated;
revoke execute on function public.mcp_can_view(uuid, text) from anon, authenticated, public;
-- The MCP route has no session, only the token: these are callable without one and check it first.
grant execute on function public.mcp_user(text), public.mcp_me(text), public.mcp_my_clubs(text), public.mcp_events(text, int),
  public.mcp_my_projects(text), public.mcp_search(text, text), public.mcp_notifications(text) to anon, authenticated;
