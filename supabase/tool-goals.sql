-- Step 78: your goal, from your AI tools (docs/mcp-workflows.md). Run after tool-talent.sql. Additive
-- and safe to re-run.
--
-- Goals (goals.sql) are what a member is working toward: an internship, a first job, grad school, a
-- research lab, a competition or funding, in a field they name. The assistant now knows it, so it can
-- rank what it drafts by it ("Toward your goal: …"), and the member can set or close it from chat.
-- - mcp_goal(): the active goal and the real record its path is built from (web/src/lib/goals.ts):
--   projects, milestones signed and waiting, who looked this month, plus the signed and open work to
--   rank. Only the member's own record: nothing invented, no market data.
-- - mcp_set_goal(), mcp_reach_goal(), mcp_drop_goal(): through goals.sql's own functions, for a token
--   allowed to post, after the member's yes. Whether companies see the goal is never assumed: the
--   tool must pass visible, true or false, which the member chose.

create or replace function public.mcp_goal(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash);
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return jsonb_build_object(
    'goal', (select jsonb_build_object('kind', g.kind, 'target', g.target, 'visible', g.visible, 'since', g.created_at)
               from public.member_goals g where g.uid = me and g.status = 'active' order by g.created_at desc limit 1),
    'last_reached', (select jsonb_build_object('kind', g.kind, 'target', g.target, 'note', g.met_note, 'at', g.closed_at)
               from public.member_goals g where g.uid = me and g.status = 'met' order by g.closed_at desc limit 1),
    'record', jsonb_build_object(
      'projects', (select count(*) from public.projects where owner_id = me),
      'signed', (select count(*) from public.milestones where owner_id = me and status = 'verified'),
      'waiting', (select count(*) from public.milestones where owner_id = me and status = 'pending'),
      'looked', coalesce((public.viewers_for(me, 30)->>'total')::int, 0)),
    'signed_work', coalesce((select jsonb_agg(x order by x->>'achieved_on' desc) from (
      select jsonb_build_object('title', m.title, 'project', p.title, 'tags', p.tags,
               'signed_by', coalesce(nullif(m.reviewer_name, ''), m.community_name), 'role', m.reviewer_role, 'achieved_on', m.achieved_on,
               'url', '/projects/' || p.id) x
        from public.milestones m join public.projects p on p.id = m.project_id
       where m.owner_id = me and m.status = 'verified' order by m.achieved_on desc limit 12) s), '[]'),
    'open_work', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'project', p.title, 'tags', p.tags,
               'status', case when m.status = 'pending' then 'waiting for the club' else 'waiting for a signature' end) order by m.created_at desc)
        from public.milestones m join public.projects p on p.id = m.project_id
       where m.owner_id = me and m.status in ('draft', 'pending')), '[]'),
    'url', '/profile');
end $$;
grant execute on function public.mcp_goal(text) to anon, authenticated;

create or replace function public.mcp_set_goal(p_hash text, p_kind text, p_target text default '', p_visible boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'post'); gid bigint;
begin
  if p_visible is null then
    raise exception 'Ask the member whether companies should see this goal (some people look quietly), then pass visible: true or false.' using errcode = 'P0001';
  end if;
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  gid := public.set_goal(p_kind, p_target, p_visible);
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('id', gid, 'status', 'set', 'kind', p_kind, 'target', btrim(coalesce(p_target, '')), 'visible', p_visible, 'url', '/profile');
end $$;
grant execute on function public.mcp_set_goal(text, text, text, boolean) to anon, authenticated;

create or replace function public.mcp_reach_goal(p_hash text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'post');
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  perform public.reach_goal(p_note);
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('status', 'reached', 'note', btrim(coalesce(p_note, '')), 'url', '/profile');
end $$;
grant execute on function public.mcp_reach_goal(text, text) to anon, authenticated;

create or replace function public.mcp_drop_goal(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.api_tokens := public.mcp_token_for(p_hash, 'post');
begin
  perform set_config('request.jwt.claim.sub', t.user_id::text, true);
  if not exists (select 1 from public.member_goals where uid = t.user_id and status = 'active') then
    raise exception 'The member doesn''t have a goal right now.' using errcode = 'P0001';
  end if;
  perform public.drop_goal();
  update public.api_tokens set last_used_at = now() where id = t.id;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('status', 'dropped', 'url', '/profile');
end $$;
grant execute on function public.mcp_drop_goal(text) to anon, authenticated;

create or replace function public.tool_goals_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.tool_goals_ready() to authenticated;
