-- Step 47: your AI tools can log a milestone with evidence and ask your club to verify it (Linear
-- FIX-80); officers can see what's waiting for them. Run after mcp-writes.sql. Additive and safe to
-- re-run.
--
-- A tool never verifies anything: it submits, and the club's officers decide, exactly as in the app.
-- mcp_log_milestone() checks the token (it needs the "post" scope), then acts as its member for that
-- one insert, so verification.sql's and rate-limits.sql's triggers run as for a request made in the
-- app: owner = the member, status = pending, evidence required, 20 pending and 20 a day at most,
-- officers notified, the request logged. As a definer it checks the insert policy itself: your own
-- project, a club you're in. The milestone records which tool logged it (milestones.via), which
-- members can't set.

-- ---------- Which tool logged a milestone ----------
alter table public.milestones add column if not exists via text;
alter table public.milestones drop constraint if exists milestones_via_ok;
alter table public.milestones add constraint milestones_via_ok check (via is null or (char_length(via) between 1 and 40 and via !~ '[<>]'));

-- ---------- Logging a milestone from a tool ----------
create or replace function public.mcp_log_milestone(p_hash text, p_project text, p_club text, p_title text, p_detail text default '',
  p_evidence text[] default '{}', p_achieved_on date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.api_tokens;
  ttl text := btrim(coalesce(p_title, ''));
  links text[];
  items jsonb;
  new_id text;
  tool text;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'That token isn''t valid.' using errcode = '42501'; end if;
  select * into t from public.api_tokens where token_hash = p_hash and revoked_at is null;
  if t.id is null then raise exception 'That token isn''t valid any more.' using errcode = '42501'; end if;
  if not ('post' = any (t.scopes)) then
    raise exception 'This token can only read. To let this tool log milestones for you, turn on "Can post" for it in Brazework → Settings → Your tools.' using errcode = 'P0001';
  end if;
  if char_length(ttl) not between 1 and 120 then raise exception 'Give the milestone a title (up to 120 characters).' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_detail, '')) > 600 then raise exception 'Keep the detail under 600 characters.' using errcode = 'P0001'; end if;

  -- Evidence: up to 8 https links, each a commit (GitHub/GitLab) or a link; the first is also the
  -- milestone's main evidence link, which every review screen shows.
  links := array(select distinct on (u) u from (select btrim(x) as u, o from unnest(coalesce(p_evidence, '{}')) with ordinality e(x, o)) s
                 where u ~ '^https://[^\s]+$' and char_length(u) between 12 and 300 order by u, o);
  links := links[1:8];
  if cardinality(links) = 0 then
    raise exception 'Add at least one https link as evidence: a commit, a pull request, a test run, a video or a doc.' using errcode = 'P0001';
  end if;
  items := (select jsonb_agg(jsonb_build_object('type', case when u ~ '^https://(github\.com|gitlab\.com)/[^/]+/[^/]+/(-/)?commits?/' then 'commit' else 'link' end, 'url', u))
            from unnest(links) u);

  -- From here on, act as the member: the triggers and checks below see them, as for a request from the app.
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  if not exists (select 1 from public.projects where id = p_project and owner_id = t.user_id) then
    raise exception 'That isn''t one of your projects. my_projects lists them with their ids.' using errcode = 'P0001';
  end if;
  if coalesce(public.my_rank(p_club), 0) <= 0 then
    raise exception 'You can only ask a club you''re in to verify. my_clubs lists them.' using errcode = 'P0001';
  end if;

  tool := public.api_token_tool(t.name);
  insert into public.milestones (project_id, community_id, title, detail, evidence, evidence_items, achieved_on, via)
  values (p_project, p_club, ttl, coalesce(p_detail, ''), links[1], items, coalesce(p_achieved_on, current_date), tool)
  returning id into new_id;
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('id', new_id, 'status', 'pending', 'club', (select name from public.communities where id = p_club),
    'project_url', '/projects/' || p_project, 'via', tool,
    'next', 'The club''s officers have been asked to verify it. It shows on your profile once they do.');
end $$;
grant execute on function public.mcp_log_milestone(text, text, text, text, text, text[], date) to anon, authenticated;

-- ---------- What's waiting for you as an officer ----------
-- Pending requests in clubs where you're a moderator or above, not your own; oldest first.
create or replace function public.mcp_review_requests(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(r order by r->>'submitted_at') from (
      select jsonb_build_object('id', m.id, 'title', m.title, 'detail', m.detail, 'club', m.community_name,
        'member', btrim(p.first_name || ' ' || p.last_name), 'project', pr.title,
        'evidence', coalesce(nullif(m.evidence, ''), m.evidence_items->0->>'url'),
        'evidence_count', greatest(jsonb_array_length(m.evidence_items), case when m.evidence <> '' then 1 else 0 end),
        'via', m.via, 'achieved_on', m.achieved_on, 'submitted_at', m.created_at,
        'review_url', '/c/' || m.community_id || '/manage?tab=verify') as r
      from public.milestones m
      join public.profiles p on p.id = m.owner_id
      left join public.projects pr on pr.id = m.project_id
      where m.status = 'pending' and m.owner_id <> me
        and exists (select 1 from public.community_members cm where cm.community_id = m.community_id and cm.uid = me and public.role_rank(cm.role) >= 3)
      order by m.created_at limit 20) s), '[]'::jsonb);
end $$;
grant execute on function public.mcp_review_requests(text) to anon, authenticated;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.mcp_milestones_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.mcp_milestones_ready() to authenticated;
