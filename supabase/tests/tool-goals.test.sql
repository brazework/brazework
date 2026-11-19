-- Tests for supabase/tool-goals.sql: an assistant reads the member's goal and the real record its path
-- is built from, and sets, reaches or drops it only with a token allowed to post, through goals.sql's
-- own functions. Whether companies see a goal is never assumed. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('b', 64), 'forge_bbbbbb', array['post']) is not null as r1 \gset
select public.create_api_token('Claude Desktop', repeat('d', 64), 'forge_dddddd', array['draft']) is not null as r2 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
update public.member_goals set status = 'dropped' where uid = :'ben' and status = 'active';

-- ---------- reading ----------
select t.ok((public.mcp_goal(repeat('b', 64))->'goal') = 'null'::jsonb, 'no goal yet: the read says so');
select t.ok((select (r->'record'->>'projects')::int >= 1 and (r->'record'->>'signed')::int >= 1 and jsonb_array_length(r->'signed_work') >= 1
             from (select public.mcp_goal(repeat('b', 64)) r) x), 'the record is the real one: Ben''s projects and signed milestones');
select t.ok(not exists (select 1 from jsonb_array_elements(public.mcp_goal(repeat('b', 64))->'signed_work') w
                         join public.milestones m on m.title = w->>'title' where m.owner_id <> :'ben'), 'only Ben''s own work');

-- ---------- setting ----------
select t.refused($$select public.mcp_set_goal(repeat('d', 64), 'internship', 'power electronics', true)$$, 'P0001', 'a drafting token can''t set a goal');
select t.refused($$select public.mcp_set_goal(repeat('b', 64), 'internship', 'power electronics')$$, 'P0001', 'visibility is never assumed: the member must choose');
select t.ok(public.mcp_set_goal(repeat('b', 64), 'internship', 'power electronics', false)->>'status' = 'set', 'with the member''s yes, a quiet goal is set');
select t.ok((select kind = 'internship' and target = 'power electronics' and not visible from public.member_goals where uid = :'ben' and status = 'active'),
  '... as an internship in power electronics, hidden from companies');
select t.ok((public.mcp_goal(repeat('b', 64))->'goal'->>'target') = 'power electronics', 'my_goal reads it back');
select t.as_('josh'); set local role authenticated;
select t.ok(not exists (select 1 from public.member_goals where uid = current_setting('t.ben')::uuid and status = 'active'), 'Josh can''t see Ben''s quiet goal');
reset role; select set_config('request.jwt.claim.sub', '', true);
select t.refused($$select public.mcp_set_goal(repeat('b', 64), 'astronaut', '', true)$$, 'P0001', 'only the app''s kinds of goal');

-- ---------- reaching and dropping ----------
select t.ok(public.mcp_reach_goal(repeat('b', 64), 'Accepted an offer at Volt Systems')->>'status' = 'reached', 'reached, with a line about how');
select t.ok((select status = 'met' and met_note like 'Accepted%' from public.member_goals where uid = :'ben' order by closed_at desc nulls last limit 1), '... recorded as met');
select t.refused($$select public.mcp_drop_goal(repeat('b', 64))$$, 'P0001', 'nothing to drop once it''s reached');
select t.refused($$select public.mcp_reach_goal(repeat('d', 64), 'x')$$, 'P0001', 'a drafting token can''t close a goal');
select t.ok(public.tool_goals_ready(), 'tool_goals_ready()');

select 'tool-goals: all passed' as passed;
rollback;
