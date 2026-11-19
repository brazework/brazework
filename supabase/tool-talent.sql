-- Step 73: company search and a résumé from your AI tools (docs/mcp-workflows.md). Run after
-- tool-officers.sql. Additive and safe to re-run.
--
-- - mcp_talent_rows(): for admins of a verified company or school only, exactly what /talent reads
--   (web/src/app/(app)/talent/page.tsx): public signed work (and, when asked, public work GitHub
--   backs) under the same rule as the milestones read policy, run as the admin, and the profile
--   fields every member can see. The server ranks it with /talent's own code (web/src/lib/talent.ts).
-- - mcp_resume(): the member's own signed (and backed) work, project by project, each with who
--   signed it and a link anyone can open: its verify page (/v/<id>, verify-links.sql) when that step
--   has run and the work is public, else its proof card (/p/<id>) when shared, else the project.
-- - follow: the last of Ember's card kinds (copilot-tools.ts propose_follow) a tool couldn't reach.
--   Following someone, as in the app (schema.sql): not yourself, not twice, not someone blocked.

create or replace function public.mcp_talent_rows(p_hash text, p_backed boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens; org jsonb; r jsonb;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'That token isn''t valid.' using errcode = '42501'; end if;
  select * into t from public.api_tokens where token_hash = p_hash and revoked_at is null;
  if t.id is null then raise exception 'That token isn''t valid any more.' using errcode = '42501'; end if;
  select jsonb_build_object('name', o.name, 'type', o.type) into org
    from public.organization_admins a join public.organizations o on o.id = a.org_id
   where a.uid = t.user_id and o.verification_status = 'verified' and o.type <> 'forge' limit 1;
  if org is null then
    raise exception 'Finding builders is for admins of a verified company or school. Register yours at Brazework → /org.' using errcode = 'P0001';
  end if;
  -- As the admin, so can_read_project() answers for them, as the read policy does.
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  with rows as (
    select m.id, m.owner_id, m.community_id, m.community_name, m.title, m.reviewer_name, m.reviewer_role, m.reviewed_at, false as backed, null::jsonb as backing, m.project_id
      from public.milestones m
     where m.status = 'verified' and not m.private and public.can_read_project(m.project_id)
    union all
    select m.id, m.owner_id, m.community_id, m.community_name, m.title, m.reviewer_name, m.reviewer_role, m.reviewed_at, true,
           (select jsonb_build_object('kind', b.kind, 'repo_full_name', b.repo_full_name, 'ref', b.ref) from public.milestone_backings b where b.milestone_id = m.id limit 1), m.project_id
      from public.milestones m
     where p_backed and m.status = 'logged' and not m.private and public.can_read_project(m.project_id) and public.milestone_backed(m.id)
  ), capped as (select * from rows order by reviewed_at desc nulls last limit 1500)
  select jsonb_build_object('org', org,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'owner_id', c.owner_id, 'community_id', c.community_id, 'community_name', coalesce(c.community_name, ''),
              'title', c.title, 'reviewer_name', coalesce(c.reviewer_name, ''), 'reviewer_role', c.reviewer_role, 'reviewed_at', c.reviewed_at, 'backed', c.backed, 'backing', c.backing,
              'projects', (select jsonb_build_object('title', p.title, 'tags', p.tags, 'tools', p.tools) from public.projects p where p.id = c.project_id))) from capped c), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'headline', coalesce(p.headline, ''), 'field', coalesce(p.field, ''),
              'open_to', p.open_to, 'grad_year', p.grad_year))
              from public.profiles p where p.id in (select owner_id from capped)), '[]'))
  into r;
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end $$;
grant execute on function public.mcp_talent_rows(text, boolean) to anon, authenticated;

create or replace function public.mcp_resume(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
-- Résumé verify pages (/v/<id>, verify-links.sql) once that step has run: the link a recruiter opens.
declare me uuid := public.mcp_user(p_hash); r jsonb; has_verify boolean := to_regprocedure('public.public_verify(text)') is not null;
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  select jsonb_build_object(
    'name', btrim(p.first_name || ' ' || p.last_name), 'headline', coalesce(p.headline, ''), 'field', coalesce(p.field, ''), 'grad_year', p.grad_year,
    'profile_url', '/u/' || p.id,
    'projects', coalesce((select jsonb_agg(x order by x->>'latest' desc nulls last) from (
      select jsonb_build_object('title', pr.title, 'summary', pr.summary, 'status', pr.status, 'year', pr.year, 'tags', pr.tags, 'private', pr.private,
               'url', '/projects/' || pr.id,
               'latest', (select max(coalesce(m.reviewed_at, m.created_at)) from public.milestones m where m.project_id = pr.id and m.owner_id = me),
               'signed', coalesce((select jsonb_agg(jsonb_build_object(
                    'title', m.title, 'achieved_on', m.achieved_on,
                    'signed_by', case when m.status = 'verified' then coalesce(nullif(m.reviewer_name, ''), m.community_name) end,
                    'signer_role', m.reviewer_role, 'club', nullif(m.community_name, ''),
                    'level', case when m.status = 'verified' then 'signed' else 'backed by GitHub (not signed)' end,
                    'link', case when has_verify and m.status = 'verified' and not pr.private then '/v/' || m.id
                                 when m.shared_at is not null and not pr.private then '/p/' || m.id else '/projects/' || pr.id end,
                    'public_card', (has_verify and m.status = 'verified' or m.shared_at is not null) and not pr.private,
                    'milestone_id', m.id) order by m.achieved_on desc)
                  from public.milestones m
                 where m.project_id = pr.id and m.owner_id = me and not m.private
                   and (m.status = 'verified' or (m.status = 'logged' and public.milestone_backed(m.id)))), '[]'),
               'unsigned', (select count(*) from public.milestones m where m.project_id = pr.id and m.owner_id = me and m.status in ('draft', 'pending'))) x
        from public.projects pr where pr.owner_id = me) s), '[]'))
  into r from public.profiles p where p.id = me;
  return r;
end $$;
grant execute on function public.mcp_resume(text) to anon, authenticated;

-- ---------- follow ----------
alter table public.tool_drafts drop constraint if exists tool_drafts_kind_check;
alter table public.tool_drafts add constraint tool_drafts_kind_check check (kind in
  ('post', 'milestone', 'project', 'project_edit', 'teammate', 'rsvp', 'join', 'invite', 'message', 'event', 'club_post', 'follow'));
create or replace function public.tool_check_follow(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who uuid := public.tool_uuid(public.tool_text(p, 'person_id'));
begin
  if who is null or not exists (select 1 from public.profiles where id = who) then raise exception 'Use a person''s id from search (people → id).' using errcode = 'P0001'; end if;
  if who = auth.uid() then raise exception 'That''s you.' using errcode = 'P0001'; end if;
  if public.blocked_between(auth.uid(), who) then raise exception 'You can''t follow them.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.follows where follower = auth.uid() and target = who) then raise exception 'You already follow them.' using errcode = 'P0001'; end if;
  return public.tool_person(who);
end $$;
create or replace function public.tool_do_follow(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into public.follows (follower, target) values (auth.uid(), (p->>'person_id')::uuid);
  return jsonb_build_object('id', p->>'person_id', 'title', p->>'name', 'url', '/u/' || (p->>'person_id'), 'status', 'following', 'via', p_via);
end $$;
revoke execute on function public.tool_check_follow(jsonb), public.tool_do_follow(jsonb, text) from anon, authenticated, public;

create or replace function public.tool_talent_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.tool_talent_ready() to authenticated;
