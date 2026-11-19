-- Step 68: one set of actions behind your AI tools and Ember (docs/mcp-workflows.md). Run after
-- money.sql. Additive and safe to re-run.
--
-- Ember (the in-app agent) prepares actions as approve-first cards; MCP tools (Claude, Cursor, …)
-- leave drafts or act with the member's yes. Both now speak the same action kinds, named after
-- Ember's cards (web/src/lib/copilot-agent.ts): a draft a tool leaves shows up as an Ember card on
-- /drafts and on Ember's page, and what Ember can prepare, a tool can draft.
--
-- 1. tool_drafts takes every action kind, not only posts and milestones.
-- 2. Each kind has tool_check_<kind>(payload): it checks the action as the member (auth.uid()),
--    under the same rules as the app's row-level security, and returns the payload cleaned, with the
--    names a card shows. Kinds a token allowed to post may do straight away also have
--    tool_do_<kind>(payload, via). Later steps add kinds by adding these two functions; the
--    dispatchers below find them by name.
-- 3. mcp_act(): a tool's call. It drafts (scope draft) or does (scope post, after the member said yes
--    in chat), acting as the token's member.
-- 4. settle_tool_draft(): the member confirmed a draft's card, which ran the app's own action
--    (the same one an Ember card runs); the draft is marked done.
-- This step's kinds: project (a new project), project_edit (its summary, write-up, link or specs)
-- and teammate (someone from your clubs, as a member or viewer, never an admin).
--
-- Never through a tool: verifying, signing, deleting, or changing anything someone else made.

-- ---------- 1. Every action kind ----------
alter table public.tool_drafts drop constraint if exists tool_drafts_kind_check;
alter table public.tool_drafts add constraint tool_drafts_kind_check check (kind in
  ('post', 'milestone', 'project', 'project_edit', 'teammate', 'rsvp', 'join', 'invite', 'message', 'event', 'club_post'));

-- ---------- 2. Dispatch by kind ----------
create or replace function public.tool_action_check(p_kind text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if not public.is_member() then raise exception 'Finish signing up in Brazework first.' using errcode = 'P0001'; end if;
  if coalesce(p_kind, '') !~ '^[a-z_]{2,20}$' or to_regprocedure(format('public.tool_check_%s(jsonb)', p_kind)) is null then
    raise exception 'Brazework can''t do that from a tool yet.' using errcode = 'P0001';
  end if;
  execute format('select public.tool_check_%s($1)', p_kind) into r using coalesce(p, '{}'::jsonb);
  return r;
end $$;

create or replace function public.tool_action_do(p_kind text, p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb; r jsonb;
begin
  if coalesce(p_kind, '') !~ '^[a-z_]{2,20}$' or to_regprocedure(format('public.tool_do_%s(jsonb,text)', p_kind)) is null then
    raise exception 'That one is always left as a draft: the member sends it from Brazework. Draft it instead.' using errcode = 'P0001';
  end if;
  c := public.tool_action_check(p_kind, p);
  execute format('select public.tool_do_%s($1, $2)', p_kind) into r using c, p_via;
  return r;
end $$;

-- ---------- 3. A tool's call ----------
-- p_draft: leave it in the member's drafts (scope draft) instead of doing it (scope post).
create or replace function public.mcp_act(p_hash text, p_kind text, p_payload jsonb, p_draft boolean default true,
  p_source text default '', p_source_key text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, case when p_draft then 'draft' else 'post' end); r jsonb;
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  if p_draft then
    r := public.tool_save_draft(t, p_kind, public.tool_action_check(p_kind, p_payload), p_source, p_source_key) || jsonb_build_object('kind', p_kind, 'drafted', true);
  else
    r := public.tool_action_do(p_kind, p_payload, public.api_token_tool(t.name)) || jsonb_build_object('kind', p_kind, 'drafted', false);
    update public.api_tokens set last_used_at = now() where id = t.id;
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end $$;
grant execute on function public.mcp_act(text, text, jsonb, boolean, text, text) to anon, authenticated;

-- ---------- 4. The member confirmed the card ----------
-- Posts and milestones go through approve_tool_draft() as before; every other kind's card runs the
-- app's own action, then marks its draft done here.
create or replace function public.settle_tool_draft(p_id uuid, p_result text default null) returns boolean
language sql security definer set search_path = public as $$
  with u as (update public.tool_drafts set status = 'posted', result_id = left(p_result, 100), decided_at = now()
             where id = p_id and user_id = auth.uid() and status = 'waiting' and kind not in ('post', 'milestone') returning 1)
  select exists (select 1 from u)
$$;
revoke execute on function public.settle_tool_draft(uuid, text) from anon, public;
grant execute on function public.settle_tool_draft(uuid, text) to authenticated;

-- ---------- Small helpers ----------
create or replace function public.tool_text(p jsonb, k text) returns text
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->k) = 'string' then btrim(p->>k) end
$$;
create or replace function public.tool_person(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('person_id', id, 'name', btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), 'headline', coalesce(headline, ''))
  from public.profiles where id = p_id
$$;
create or replace function public.tool_uuid(p text) returns uuid
language sql immutable set search_path = public as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;

-- ---------- Kind: project (a new project on the member's profile) ----------
-- The app's rules (projects.sql, web/src/lib/projects.ts): title 1-120, summary 1-600, write-up up to
-- 5,000, an http(s) link, up to 3 topics, in progress or completed (with a year). Topics are checked
-- against the app's list by the server before they get here.
create or replace function public.tool_check_project(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ttl text := coalesce(public.tool_text(p, 'title'), ''); sm text := coalesce(public.tool_text(p, 'summary'), '');
  det text := coalesce(public.tool_text(p, 'details'), ''); lnk text := coalesce(public.tool_text(p, 'link'), '');
  st text := coalesce(public.tool_text(p, 'status'), 'in_progress'); yr text := coalesce(public.tool_text(p, 'year'), '');
begin
  if char_length(ttl) not between 1 and 120 then raise exception 'Give the project a title (up to 120 characters).' using errcode = 'P0001'; end if;
  if char_length(sm) not between 1 and 600 then raise exception 'Add a one-paragraph summary (up to 600 characters).' using errcode = 'P0001'; end if;
  if char_length(det) > 5000 then raise exception 'Keep the write-up under 5,000 characters.' using errcode = 'P0001'; end if;
  if lnk <> '' and (char_length(lnk) > 300 or lnk !~* '^https?://[^\s]+$') then raise exception 'The link must start with https:// (up to 300 characters).' using errcode = 'P0001'; end if;
  if st not in ('in_progress', 'completed') then raise exception 'status is in_progress or completed.' using errcode = 'P0001'; end if;
  if yr <> '' and (st <> 'completed' or yr !~ '^\d{4}$' or yr::int not between 1950 and 2100) then yr := ''; end if;
  if (select count(*) from public.projects where owner_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You''ve added 10 projects this hour. Try again later.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('title', ttl, 'summary', sm, 'details', det, 'link', lnk, 'status', st, 'year', yr,
    'tags', to_jsonb((public.tool_tags(array(select jsonb_array_elements_text(case when jsonb_typeof(p->'tags') = 'array' then p->'tags' else '[]' end))))[1:3]));
end $$;

create or replace function public.tool_do_project(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare new_id text;
begin
  insert into public.projects (title, summary, status, year, tags, private)
  values (p->>'title', p->>'summary', p->>'status', nullif(p->>'year', '')::smallint, array(select jsonb_array_elements_text(p->'tags')), false)
  returning id into new_id;
  insert into public.project_details (project_id, details, link) values (new_id, p->>'details', p->>'link');
  return jsonb_build_object('id', new_id, 'title', p->>'title', 'url', '/projects/' || new_id, 'status', 'added', 'via', p_via);
end $$;

-- ---------- Kind: project_edit (summary, write-up, link or specs of the member's own project) ----------
-- Only the owner edits a project (projects.sql: "edit your projects"). Fields left out stay as they
-- are; the card shows what was there before.
create or replace function public.tool_check_project_edit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid text := coalesce(public.tool_text(p, 'project_id'), ''); pr public.projects; d public.project_details;
  sm text := public.tool_text(p, 'summary'); det text := public.tool_text(p, 'details'); lnk text := public.tool_text(p, 'link');
  sp jsonb := case when jsonb_typeof(p->'specs') = 'array' then p->'specs' end; out jsonb;
begin
  select * into pr from public.projects where id = pid and owner_id = auth.uid();
  if pr.id is null then raise exception 'That isn''t one of your projects. my_projects lists them with their ids.' using errcode = 'P0001'; end if;
  if sm is null and det is null and lnk is null and sp is null then
    raise exception 'Say what to change: summary, details, link or specs.' using errcode = 'P0001';
  end if;
  if sm is not null and char_length(sm) not between 1 and 600 then raise exception 'The summary is 1 to 600 characters.' using errcode = 'P0001'; end if;
  if det is not null and char_length(det) > 5000 then raise exception 'Keep the write-up under 5,000 characters.' using errcode = 'P0001'; end if;
  if lnk is not null and lnk <> '' and (char_length(lnk) > 300 or lnk !~* '^https?://[^\s]+$') then raise exception 'The link must start with https:// (up to 300 characters).' using errcode = 'P0001'; end if;
  if sp is not null then
    sp := coalesce((select jsonb_agg(jsonb_build_object('label', btrim(e->>'label'), 'value', btrim(e->>'value')) order by o)
                    from jsonb_array_elements(sp) with ordinality s(e, o) where jsonb_typeof(e) = 'object'), '[]');
    if not public.project_specs_ok(sp) then
      raise exception 'Specs are up to 16 label/value pairs: labels up to 40 characters, values up to 80.' using errcode = 'P0001';
    end if;
  end if;
  select * into d from public.project_details where project_id = pid;
  out := jsonb_build_object('project_id', pid, 'project_title', pr.title,
    'before', jsonb_build_object('summary', pr.summary, 'details', coalesce(d.details, ''), 'link', coalesce(d.link, ''), 'specs', coalesce(d.specs, '[]')));
  if sm is not null then out := out || jsonb_build_object('summary', sm); end if;
  if det is not null then out := out || jsonb_build_object('details', det); end if;
  if lnk is not null then out := out || jsonb_build_object('link', lnk); end if;
  if sp is not null then out := out || jsonb_build_object('specs', sp); end if;
  return out;
end $$;

create or replace function public.tool_do_project_edit(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid text := p->>'project_id';
begin
  if p ? 'summary' then update public.projects set summary = p->>'summary' where id = pid and owner_id = auth.uid(); end if;
  if p ? 'details' or p ? 'link' or p ? 'specs' then
    insert into public.project_details (project_id) values (pid) on conflict (project_id) do nothing;
    update public.project_details set
      details = case when p ? 'details' then p->>'details' else details end,
      link = case when p ? 'link' then p->>'link' else link end,
      specs = case when p ? 'specs' then p->'specs' else specs end
    where project_id = pid;
  end if;
  update public.projects set updated_at = now() where id = pid;
  return jsonb_build_object('id', pid, 'title', p->>'project_title', 'url', '/projects/' || pid, 'status', 'updated', 'via', p_via,
    'changed', (select coalesce(jsonb_agg(k), '[]') from unnest(array['summary', 'details', 'link', 'specs']) k where p ? k));
end $$;

-- ---------- Kind: teammate (someone from the member's clubs, on one of their projects) ----------
-- The app's rule (project-access.sql): the project's owner or an admin adds people, never
-- themselves. From a tool, only as a teammate (member) or a viewer, and only someone who shares a
-- club with the member, so a tool can't put strangers on a project.
create or replace function public.tool_check_teammate(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid text := coalesce(public.tool_text(p, 'project_id'), ''); who uuid := public.tool_uuid(public.tool_text(p, 'person_id'));
  rl text := coalesce(nullif(public.tool_text(p, 'role'), ''), 'member'); pr public.projects;
begin
  if rl not in ('member', 'viewer') then raise exception 'role is member (a teammate who builds) or viewer. Make someone an admin from the project in Brazework.' using errcode = 'P0001'; end if;
  select * into pr from public.projects where id = pid;
  if pr.id is null or not public.can_manage_project_member(pid, rl) then
    raise exception 'Only the project''s owner or an admin can add people. my_projects lists your projects with their ids.' using errcode = 'P0001';
  end if;
  if who is null or not exists (select 1 from public.profiles where id = who) then raise exception 'Use a person''s id from search (people → id).' using errcode = 'P0001'; end if;
  if who = auth.uid() then raise exception 'You''re already on your own project.' using errcode = 'P0001'; end if;
  if public.blocked_between(auth.uid(), who) then raise exception 'You can''t add them.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.community_members a join public.community_members b on b.community_id = a.community_id
                 where a.uid = auth.uid() and b.uid = who) then
    raise exception 'They aren''t in any of your clubs. Add people you don''t share a club with from the project in Brazework.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.project_members where project_id = pid and uid = who) or pr.owner_id = who then
    raise exception 'They''re already on this project.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('project_id', pid, 'project_title', pr.title, 'role', rl) || public.tool_person(who);
end $$;

create or replace function public.tool_do_teammate(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, uid, role) values (p->>'project_id', (p->>'person_id')::uuid, p->>'role');
  return jsonb_build_object('id', p->>'project_id', 'title', p->>'project_title', 'url', '/projects/' || (p->>'project_id'),
    'status', 'added', 'person', p->>'name', 'role', p->>'role', 'via', p_via);
end $$;

revoke execute on function public.tool_action_check(text, jsonb), public.tool_action_do(text, jsonb, text),
  public.tool_text(jsonb, text), public.tool_person(uuid), public.tool_uuid(text),
  public.tool_check_project(jsonb), public.tool_do_project(jsonb, text), public.tool_check_project_edit(jsonb),
  public.tool_do_project_edit(jsonb, text), public.tool_check_teammate(jsonb), public.tool_do_teammate(jsonb, text)
  from anon, authenticated, public;

-- approve_tool_draft (mcp-workflows.sql) made anything that wasn't a post into a milestone; now it
-- says other kinds are confirmed from their card.
create or replace function public.approve_tool_draft(p_id uuid, p_body text default null, p_title text default null, p_detail text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.tool_drafts; p jsonb; new_id text;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  select * into d from public.tool_drafts where id = p_id and user_id = auth.uid() for update;
  if d.id is null then raise exception 'That draft isn''t yours.' using errcode = '42501'; end if;
  if d.status <> 'waiting' then raise exception 'That draft was already %.', d.status using errcode = 'P0001'; end if;
  if d.kind not in ('post', 'milestone') then raise exception 'Confirm this one from its card.' using errcode = 'P0001'; end if;
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

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.tool_actions_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.tool_actions_ready() to authenticated;
