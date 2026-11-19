-- Step 64: your tools fill in your record, and you approve it (docs/mcp-workflows.md). Run after
-- members-only.sql. Additive and safe to re-run.
--
-- 1. Drafts. A token may now "draft": leave a post or a milestone in the member's drafts, which nobody
--    else sees and which goes out only when the member taps Post in Brazework (/drafts). Scopes are
--    read ⊂ draft ⊂ post: new tokens draft by default, a token allowed to post may also draft, and a
--    token made for GitHub Actions can only read and draft. Old read-only tokens keep exactly what
--    they had. An automation that runs again passes the same source_key and gets the same draft back.
-- 2. Signatures from chat. mcp_request_vouch() lets a token that may post ask someone who saw the work
--    to sign a milestone, through vouches.sql's request_vouch() and all its guards (school or verified
--    company address, never a teammate, 3 a milestone, 10 a week). The server makes the link and
--    sends the email, as for an ask from the app.
-- 3. log_milestone without a club: the milestone waits as a draft for a signature, as in the app.
--    my_projects lists the milestones still waiting, with their ids.
--
-- Nothing a tool does goes around the app's rules: drafts are checked when they're made (your own
-- project, a club you're in) and again when you approve them, which runs as you, through the same
-- triggers as a post or a milestone made in the app.

-- ---------- What a token may do: read, draft, post ----------
alter table public.api_tokens drop constraint if exists api_tokens_scopes_ok;
alter table public.api_tokens add constraint api_tokens_scopes_ok
  check (scopes <@ array['read', 'draft', 'post'] and 'read' = any (scopes));

create or replace function public.create_api_token(p_name text, p_hash text, p_prefix text, p_scopes text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; s text[] := coalesce(p_scopes, '{}');
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if (select count(*) from public.api_tokens where user_id = auth.uid() and revoked_at is null) >= 5 then
    raise exception 'You can have up to 5 active tokens. Revoke one first.' using errcode = 'P0001';
  end if;
  insert into public.api_tokens (user_id, name, token_hash, prefix, scopes)
  values (auth.uid(), btrim(p_name), p_hash, p_prefix,
          case when 'post' = any (s) then array['read', 'draft', 'post']
               when 'draft' = any (s) then array['read', 'draft']
               else array['read'] end)
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.create_api_token(text, text, text, text[]) from anon, public;
grant execute on function public.create_api_token(text, text, text, text[]) to authenticated;

-- Posting on or off. Off still leaves drafts for you to approve; an automation token never posts.
create or replace function public.set_api_token_post(p_id uuid, p_post boolean) returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update public.api_tokens set scopes = case when p_post then array['read', 'draft', 'post'] else array['read', 'draft'] end
    where id = p_id and user_id = auth.uid() and revoked_at is null and name not ilike 'GitHub Actions%' returning 1
  ) select exists (select 1 from u)
$$;
revoke execute on function public.set_api_token_post(uuid, boolean) from anon, public;
grant execute on function public.set_api_token_post(uuid, boolean) to authenticated;

create or replace function public.api_token_tool(p_name text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_name ilike 'Claude Code%' then 'Claude Code'
    when p_name ilike 'Cursor%' then 'Cursor'
    when p_name ilike 'VS Code%' then 'VS Code'
    when p_name ilike 'Codex%' then 'Codex'
    when p_name ilike 'Windsurf%' then 'Windsurf'
    when p_name ilike 'Zed%' then 'Zed'
    when p_name ilike 'GitHub Actions%' then 'GitHub Actions'
    when p_name ilike 'Claude%' then 'Claude'
    else 'an AI tool' end
$$;

-- ---------- Shared checks for what a tool hands in ----------
-- The token behind a call, with the scope it needs; raises the sentence the member's tool shows.
create or replace function public.mcp_token_for(p_hash text, p_need text) returns public.api_tokens
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'That token isn''t valid.' using errcode = '42501'; end if;
  select * into t from public.api_tokens where token_hash = p_hash and revoked_at is null;
  if t.id is null then raise exception 'That token isn''t valid any more.' using errcode = '42501'; end if;
  if p_need = 'post' and not ('post' = any (t.scopes)) then
    raise exception 'This token can''t post for you. Leave it as a draft instead (draft_post, draft_milestone), or turn on "Can post" for it in Brazework → Settings → Your tools.' using errcode = 'P0001';
  end if;
  if p_need = 'draft' and not ('draft' = any (t.scopes) or 'post' = any (t.scopes)) then
    raise exception 'This token can only read. Make a new token in Brazework → Settings → Your tools to leave drafts.' using errcode = 'P0001';
  end if;
  return t;
end $$;

-- Up to 3 topics, cleaned as the app cleans them.
create or replace function public.tool_tags(p_tags text[]) returns text[]
language sql immutable set search_path = public as $$
  select coalesce((select array_agg(x order by o) from (
    select distinct on (lower(btrim(x))) btrim(x) as x, o from unnest(coalesce(p_tags, '{}')) with ordinality u(x, o)
    where btrim(x) ~ '^[A-Za-z0-9][A-Za-z0-9 &+./-]{0,39}$' order by lower(btrim(x)), o) s), '{}')
$$;

-- Evidence: up to 8 distinct https links, each a commit (GitHub/GitLab) or a link, in the order given.
create or replace function public.tool_evidence(p_links text[]) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('type',
           case when u ~ '^https://(github\.com|gitlab\.com)/[^/]+/[^/]+/(-/)?commits?/' then 'commit' else 'link' end, 'url', u) order by o), '[]')
  from (select u, min(o) as o from (select btrim(x) as u, o from unnest(coalesce(p_links, '{}')) with ordinality e(x, o)) s
        where u ~ '^https://[^\s]+$' and char_length(u) between 12 and 300 group by u order by min(o) limit 8) l
$$;

-- Your own project, a club you're in. Runs as the member (auth.uid()).
create or replace function public.tool_check_target(p_project text, p_club text, p_project_required boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_project is null and p_project_required then raise exception 'Pick one of your projects. my_projects lists them with their ids.' using errcode = 'P0001'; end if;
  if p_project is not null and not exists (select 1 from public.projects where id = p_project and owner_id = auth.uid()) then
    raise exception 'That isn''t one of your projects. my_projects lists them with their ids.' using errcode = 'P0001';
  end if;
  if p_club is not null and coalesce(public.my_rank(p_club), 0) <= 0 then
    raise exception 'You can only share with or ask clubs you''re in. my_clubs lists them.' using errcode = 'P0001';
  end if;
end $$;

-- A post's fields, checked. Raises what's wrong.
create or replace function public.tool_post_payload(p_body text, p_kind text, p_project text, p_club text, p_tags text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare txt text := btrim(coalesce(p_body, '')); k text := coalesce(nullif(btrim(p_kind), ''), 'update');
begin
  if char_length(txt) not between 1 and 3000 then raise exception 'Write between 1 and 3,000 characters.' using errcode = 'P0001'; end if;
  if k not in ('update', 'result', 'question') then raise exception 'kind is update, result or question.' using errcode = 'P0001'; end if;
  perform public.tool_check_target(nullif(p_project, ''), nullif(p_club, ''), false);
  return jsonb_build_object('body', txt, 'kind', k, 'project_id', nullif(p_project, ''), 'club_id', nullif(p_club, ''),
                            'tags', to_jsonb((public.tool_tags(p_tags))[1:3]));
end $$;

-- A milestone's fields, checked. Raises what's wrong.
create or replace function public.tool_milestone_payload(p_project text, p_club text, p_title text, p_detail text, p_evidence text[], p_achieved_on date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ttl text := btrim(coalesce(p_title, '')); ev jsonb := public.tool_evidence(p_evidence);
begin
  if char_length(ttl) not between 1 and 120 then raise exception 'Give the milestone a title (up to 120 characters).' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_detail, '')) > 600 then raise exception 'Keep the detail under 600 characters.' using errcode = 'P0001'; end if;
  if jsonb_array_length(ev) = 0 then
    raise exception 'Add at least one https link as evidence: a commit, a pull request, a test run, a video or a doc.' using errcode = 'P0001';
  end if;
  if p_achieved_on is not null and p_achieved_on > current_date + 1 then raise exception 'achieved_on can''t be in the future.' using errcode = 'P0001'; end if;
  perform public.tool_check_target(nullif(p_project, ''), nullif(p_club, ''), true);
  return jsonb_build_object('project_id', p_project, 'club_id', nullif(p_club, ''), 'title', ttl, 'detail', coalesce(p_detail, ''),
                            'evidence', ev, 'achieved_on', coalesce(p_achieved_on, current_date));
end $$;

-- Makes the milestone, as the signed-in member: with a club it asks the club to verify (pending);
-- without one it waits as a draft for a signature.
create or replace function public.tool_insert_milestone(p jsonb, p_via text) returns text
language plpgsql security definer set search_path = public as $$
declare new_id text;
begin
  insert into public.milestones (project_id, community_id, title, detail, evidence, evidence_items, achieved_on, via, status)
  values (p->>'project_id', nullif(p->>'club_id', ''), p->>'title', coalesce(p->>'detail', ''), p->'evidence'->0->>'url', p->'evidence',
          (p->>'achieved_on')::date, p_via, case when nullif(p->>'club_id', '') is null then 'draft' else 'pending' end)
  returning id into new_id;
  return new_id;
end $$;

revoke execute on function public.mcp_token_for(text, text), public.tool_check_target(text, text, boolean),
  public.tool_post_payload(text, text, text, text, text[]), public.tool_milestone_payload(text, text, text, text, text[], date),
  public.tool_insert_milestone(jsonb, text) from anon, authenticated, public;

-- ---------- log_milestone: the club is now optional ----------
create or replace function public.mcp_log_milestone(p_hash text, p_project text, p_club text, p_title text, p_detail text default '',
  p_evidence text[] default '{}', p_achieved_on date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'post'); pl jsonb; new_id text; tool text := public.api_token_tool(t.name);
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  pl := public.tool_milestone_payload(p_project, p_club, p_title, p_detail, p_evidence, p_achieved_on);
  new_id := public.tool_insert_milestone(pl, tool);
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  if pl->>'club_id' is null then
    return jsonb_build_object('id', new_id, 'status', 'draft', 'project_url', '/projects/' || p_project, 'via', tool,
      'next', 'It''s saved and waiting for a signature. Ask the person who saw it (a professor, PI, TA, manager or mentor) with request_signature, using their university or company email.');
  end if;
  return jsonb_build_object('id', new_id, 'status', 'pending', 'club', (select name from public.communities where id = p_club),
    'project_url', '/projects/' || p_project, 'via', tool,
    'next', 'The club''s officers have been asked to verify it. It shows on your profile once they do.');
end $$;
grant execute on function public.mcp_log_milestone(text, text, text, text, text, text[], date) to anon, authenticated;

-- ---------- my_projects: also the milestones still waiting, with ids (to ask for a signature) ----------
create or replace function public.mcp_my_projects(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'summary', p.summary, 'status', p.status, 'private', p.private,
             'url', '/projects/' || p.id,
             'verified_milestones', coalesce((select jsonb_agg(jsonb_build_object('title', m.title, 'club', m.community_name, 'achieved_on', m.achieved_on) order by m.achieved_on desc)
                                      from public.milestones m where m.project_id = p.id and m.status = 'verified'), '[]'),
             'open_milestones', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'status', m.status,
                                        'club', nullif(m.community_name, ''), 'achieved_on', m.achieved_on,
                                        'signatures_asked', (select count(*) from public.milestone_vouches v where v.milestone_id = m.id and v.state = 'asked' and v.expires_at > now()))
                                      order by m.created_at desc)
                                   from public.milestones m where m.project_id = p.id and m.owner_id = me and m.status in ('draft', 'pending')), '[]'))
           order by p.updated_at desc)
    from public.projects p where p.owner_id = me), '[]');
end $$;
grant execute on function public.mcp_my_projects(text) to anon, authenticated;

-- ---------- Drafts ----------
create table if not exists public.tool_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'milestone')),
  payload jsonb not null,
  via text not null check (char_length(via) between 1 and 40 and via !~ '[<>]'),
  source text not null default '' check (char_length(source) <= 140 and source !~ '[<>]'),
  source_key text check (source_key is null or char_length(source_key) between 1 and 200),
  status text not null default 'waiting' check (status in ('waiting', 'posted', 'dismissed')),
  result_id text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists tool_drafts_source_key on public.tool_drafts (user_id, source_key) where source_key is not null;
create index if not exists tool_drafts_user_idx on public.tool_drafts (user_id, status, created_at desc);
alter table public.tool_drafts enable row level security;
drop policy if exists "your drafts" on public.tool_drafts;
create policy "your drafts" on public.tool_drafts for select to authenticated using (user_id = (select auth.uid()));
-- members-only.sql (FIX-138): signed-in accounts read nothing until they're members.
drop policy if exists "members only" on public.tool_drafts;
create policy "members only" on public.tool_drafts as restrictive for select to authenticated using ((select public.is_member()));
revoke all on public.tool_drafts from anon, authenticated;
grant select on public.tool_drafts to authenticated;

-- Saves a draft for the token's member (already acting as them). The same source_key returns the
-- draft it made before, whatever became of it: a dismissed draft doesn't come back on a re-run.
create or replace function public.tool_save_draft(t public.api_tokens, p_kind text, p jsonb, p_source text, p_source_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.tool_drafts; k text := nullif(btrim(coalesce(p_source_key, '')), ''); src text := left(regexp_replace(btrim(coalesce(p_source, '')), '[<>]', '', 'g'), 140);
begin
  if k is not null then
    select * into d from public.tool_drafts where user_id = t.user_id and source_key = left(k, 200);
    if d.id is not null then
      return jsonb_build_object('id', d.id, 'status', d.status, 'duplicate', true, 'review_url', '/drafts',
        'next', 'This was drafted before (same source_key), so nothing new was made.');
    end if;
  end if;
  if (select count(*) from public.tool_drafts where user_id = t.user_id and status = 'waiting') >= 30 then
    raise exception 'You have 30 drafts waiting. Review some in Brazework (/drafts) first.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.tool_drafts where user_id = t.user_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Your tools have left 20 drafts this hour. Try again later.' using errcode = 'P0001';
  end if;
  insert into public.tool_drafts (user_id, kind, payload, via, source, source_key)
  values (t.user_id, p_kind, p, public.api_token_tool(t.name), src, left(k, 200)) returning * into d;
  update public.api_tokens set last_used_at = now() where id = t.id;
  return jsonb_build_object('id', d.id, 'status', 'waiting', 'duplicate', false, 'review_url', '/drafts', 'via', d.via,
    'next', 'Saved to the member''s drafts. Nothing is posted until they approve it in Brazework.');
end $$;
revoke execute on function public.tool_save_draft(public.api_tokens, text, jsonb, text, text) from anon, authenticated, public;

create or replace function public.mcp_draft_post(p_hash text, p_body text, p_kind text default 'update', p_project text default null,
  p_club text default null, p_tags text[] default '{}', p_source text default '', p_source_key text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'draft'); r jsonb;
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  r := public.tool_save_draft(t, 'post', public.tool_post_payload(p_body, p_kind, p_project, p_club, p_tags), p_source, p_source_key);
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end $$;
grant execute on function public.mcp_draft_post(text, text, text, text, text, text[], text, text) to anon, authenticated;

create or replace function public.mcp_draft_milestone(p_hash text, p_project text, p_club text default null, p_title text default '',
  p_detail text default '', p_evidence text[] default '{}', p_achieved_on date default null, p_source text default '', p_source_key text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'draft'); r jsonb;
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  r := public.tool_save_draft(t, 'milestone', public.tool_milestone_payload(p_project, p_club, p_title, p_detail, p_evidence, p_achieved_on), p_source, p_source_key);
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end $$;
grant execute on function public.mcp_draft_milestone(text, text, text, text, text, text[], date, text, text) to anon, authenticated;

-- The member approves a draft in the app, optionally edited: it's checked again and made as them,
-- through the same triggers (posting pace, milestone limits, officers told) as anything made in the app.
create or replace function public.approve_tool_draft(p_id uuid, p_body text default null, p_title text default null, p_detail text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.tool_drafts; p jsonb; new_id text;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  select * into d from public.tool_drafts where id = p_id and user_id = auth.uid() for update;
  if d.id is null then raise exception 'That draft isn''t yours.' using errcode = '42501'; end if;
  if d.status <> 'waiting' then raise exception 'That draft was already %.', d.status using errcode = 'P0001'; end if;
  if d.kind = 'post' then
    p := public.tool_post_payload(coalesce(p_body, d.payload->>'body'), d.payload->>'kind', d.payload->>'project_id', d.payload->>'club_id',
                                  array(select jsonb_array_elements_text(coalesce(d.payload->'tags', '[]'))));
    insert into public.posts (author_id, body, kind, tags, community_id, project_id, via)
    values (auth.uid(), p->>'body', p->>'kind', array(select jsonb_array_elements_text(p->'tags')), p->>'club_id', p->>'project_id', d.via)
    returning id into new_id;
  else
    p := public.tool_milestone_payload(d.payload->>'project_id', d.payload->>'club_id', coalesce(p_title, d.payload->>'title'),
                                       coalesce(p_detail, d.payload->>'detail'),
                                       array(select e->>'url' from jsonb_array_elements(d.payload->'evidence') e), (d.payload->>'achieved_on')::date);
    new_id := public.tool_insert_milestone(p, d.via);
  end if;
  update public.tool_drafts set status = 'posted', result_id = new_id, decided_at = now(), payload = p where id = d.id;
  return jsonb_build_object('kind', d.kind, 'id', new_id,
    'url', case when d.kind = 'post' then '/post/' || new_id else '/projects/' || (p->>'project_id') end,
    'status', case when d.kind = 'post' then 'posted' when p->>'club_id' is null then 'draft' else 'pending' end);
end $$;
revoke execute on function public.approve_tool_draft(uuid, text, text, text) from anon, public;
grant execute on function public.approve_tool_draft(uuid, text, text, text) to authenticated;

create or replace function public.dismiss_tool_draft(p_id uuid) returns boolean
language sql security definer set search_path = public as $$
  with u as (update public.tool_drafts set status = 'dismissed', decided_at = now()
             where id = p_id and user_id = auth.uid() and status = 'waiting' returning 1)
  select exists (select 1 from u)
$$;
revoke execute on function public.dismiss_tool_draft(uuid) from anon, public;
grant execute on function public.dismiss_tool_draft(uuid) to authenticated;

-- ---------- Signatures from chat ----------
-- The server makes the link token and passes only its hash; it then emails the link, and withdraws
-- the ask if the email can't go out. Returns what the email needs.
create or replace function public.mcp_request_vouch(p_hash text, p_milestone text, p_email text, p_relationship text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'post'); vid bigint; m public.milestones; pr public.projects; me public.profiles;
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  vid := public.request_vouch(p_milestone, p_email, p_relationship, p_token_hash);
  select * into m from public.milestones where id = p_milestone;
  select * into pr from public.projects where id = m.project_id;
  select * into me from public.profiles where id = t.user_id;
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('vouch_id', vid, 'member', btrim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')),
    'title', m.title, 'project', coalesce(pr.title, ''), 'milestone_url', '/projects/' || m.project_id);
end $$;
grant execute on function public.mcp_request_vouch(text, text, text, text, text) to anon, authenticated;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.mcp_workflows_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.mcp_workflows_ready() to authenticated;
