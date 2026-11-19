-- Tests for supabase/tool-actions.sql: one set of actions behind MCP tools and Ember. A token that
-- drafts leaves a project, an edit or a teammate in the member's drafts (checked first, as the
-- member); a token that posts does them straight away, under the same rules as the app; nobody adds
-- strangers, admins or themselves, or edits someone else's project; the member settles a draft once
-- its card ran the app's action. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

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

-- Ben: a token that drafts (d) and one that posts (p). Josh: one that drafts (j).
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Desktop', repeat('d', 64), 'forge_dddddd', array['draft']) is not null as r1 \gset
select public.create_api_token('Claude Code', repeat('e', 64), 'forge_eeeeee', array['post']) is not null as r2 \gset
reset role; select t.as_('josh'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('1', 64), 'forge_111111', array['draft']) is not null as r3 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);

-- The MCP route has no session: it calls as anon, with the token's hash (checks below run as the database).
select t.ok(has_function_privilege('anon', 'public.mcp_act(text, text, jsonb, boolean, text, text)', 'execute'), 'the MCP route (anon) can call mcp_act');
select t.ok(not has_function_privilege('authenticated', 'public.tool_check_project(jsonb)', 'execute') and not has_function_privilege('anon', 'public.tool_do_project(jsonb, text)', 'execute'), 'the per-kind checks and actions can''t be called directly');

-- ---------- project ----------
select t.ok((public.mcp_act(repeat('d', 64), 'project', '{"title":"Hopper drone","summary":"A tethered hopper to test the engine gimbal.","tags":["Robotics","x<y>"],"link":"https://github.com/ben/hopper"}', true)->>'drafted')::boolean,
  'a drafting token leaves a new project in the member''s drafts');
select t.ok(not exists (select 1 from public.projects where title = 'Hopper drone'), '... and nothing is made yet');
select t.ok((select payload->>'title' = 'Hopper drone' and payload->'tags' = '["Robotics"]' and payload->>'status' = 'in_progress'
             from public.tool_drafts where kind = 'project' and status = 'waiting' and user_id = current_setting('t.ben')::uuid), '... cleaned: bad topics dropped, in progress by default');
select t.refused($$select public.mcp_act(repeat('d', 64), 'project', '{"title":"x","summary":"y"}', false)$$, 'P0001', 'a drafting token can''t make a project straight away');
select t.refused($$select public.mcp_act(repeat('d', 64), 'project', '{"title":"","summary":"y"}', true)$$, 'P0001', 'a project needs a title');
select t.refused($$select public.mcp_act(repeat('d', 64), 'project', '{"title":"x","summary":"y","link":"javascript:alert(1)"}', true)$$, 'P0001', 'links are http(s) only');
select t.ok((public.mcp_act(repeat('e', 64), 'project', '{"title":"Thrust stand v2","summary":"Load cell, 2 kN.","status":"completed","year":"2026"}', false)->>'url') like '/projects/%',
  'a posting token adds the project at once, with a link to it');
select t.ok((select owner_id = current_setting('t.ben')::uuid and status = 'completed' and year = 2026 from public.projects where title = 'Thrust stand v2'),
  '... owned by the member, as they said');
select t.ok(exists (select 1 from public.project_details d join public.projects p on p.id = d.project_id where p.title = 'Thrust stand v2'), '... with its details row');

-- ---------- project_edit ----------
select t.ok((public.mcp_act(repeat('d', 64), 'project_edit', '{"project_id":"p1","summary":"Static fires at 1.2 kN.","specs":[{"label":"Thrust","value":"1.2 kN"}]}', true)->>'drafted')::boolean,
  'a drafting token leaves an edit to a project');
select t.ok((select payload->'before'->>'summary' is not null and payload->>'project_title' = 'Liquid engine test stand' and not payload ? 'details'
             from public.tool_drafts where kind = 'project_edit' and status = 'waiting'), '... with what it replaces, the project''s name, and only the fields it changes');
select t.refused($$select public.mcp_act(repeat('1', 64), 'project_edit', '{"project_id":"p1","summary":"mine now"}', true)$$, 'P0001', 'nobody drafts an edit to someone else''s project');
select t.refused($$select public.mcp_act(repeat('d', 64), 'project_edit', '{"project_id":"p1"}', true)$$, 'P0001', 'an edit says what to change');
select t.refused($$select public.mcp_act(repeat('d', 64), 'project_edit', '{"project_id":"p1","specs":[{"label":"","value":"x"}]}', true)$$, 'P0001', 'specs follow the app''s rules');
select t.ok(public.mcp_act(repeat('e', 64), 'project_edit', '{"project_id":"p2","summary":"Dual-deploy, two altimeters.","specs":[{"label":"Mass","value":"180 g"}]}', false)->'changed' = '["summary", "specs"]',
  'a posting token edits the member''s project at once, and says what changed');
select t.ok((select p.summary = 'Dual-deploy, two altimeters.' and d.specs = '[{"label":"Mass","value":"180 g"}]' from public.projects p join public.project_details d on d.project_id = p.id where p.id = 'p2'),
  '... summary and specs saved');

-- ---------- teammate ----------
select t.ok((public.mcp_act(repeat('d', 64), 'teammate', format('{"project_id":"p1","person_id":"%s"}', current_setting('t.josh'))::jsonb, true)->>'drafted')::boolean,
  'a drafting token leaves a teammate to add (Josh is in Ben''s club)');
select t.ok((select payload->>'name' = 'Josh Menzies' and payload->>'role' = 'member' from public.tool_drafts where kind = 'teammate' and status = 'waiting'), '... as a teammate, with his name for the card');
select t.refused(format($$select public.mcp_act(repeat('d', 64), 'teammate', '{"project_id":"p1","person_id":"%s"}', true)$$, current_setting('t.cara')), 'P0001', 'not someone who shares none of the member''s clubs');
select t.refused(format($$select public.mcp_act(repeat('d', 64), 'teammate', '{"project_id":"p1","person_id":"%s","role":"admin"}', true)$$, current_setting('t.josh')), 'P0001', 'never as an admin');
select t.refused(format($$select public.mcp_act(repeat('d', 64), 'teammate', '{"project_id":"p1","person_id":"%s"}', true)$$, current_setting('t.ben')), 'P0001', 'not the member themselves');
select t.refused(format($$select public.mcp_act(repeat('1', 64), 'teammate', '{"project_id":"p1","person_id":"%s"}', true)$$, current_setting('t.maya')), 'P0001', 'not onto a project you don''t run');
select t.ok(public.mcp_act(repeat('e', 64), 'teammate', format('{"project_id":"p2","person_id":"%s","role":"viewer"}', current_setting('t.maya'))::jsonb, false)->>'status' = 'added',
  'a posting token adds Maya to Ben''s project as a viewer');
select t.ok((select role = 'viewer' from public.project_members where project_id = 'p2' and uid = current_setting('t.maya')::uuid), '... with that role');
select t.refused(format($$select public.mcp_act(repeat('e', 64), 'teammate', '{"project_id":"p2","person_id":"%s"}', false)$$, current_setting('t.maya')), 'P0001', 'not twice');

-- ---------- kinds that don't exist, and drafts-only ----------
select t.refused($$select public.mcp_act(repeat('d', 64), 'verify', '{}', true)$$, 'P0001', 'a tool can''t name an action that doesn''t exist (no verifying)');
select t.refused($$select public.mcp_act(repeat('d', 64), 'x; drop table projects', '{}', true)$$, 'P0001', 'kinds are names, nothing else');
select t.refused($$select public.mcp_act(repeat('0', 64), 'project', '{"title":"x","summary":"y"}', true)$$, '42501', 'an unknown token is refused');

-- ---------- The member confirms or dismisses from the card ----------
select id as edit_draft from public.tool_drafts where kind = 'project_edit' and user_id = :'ben' and status = 'waiting' \gset
select id as team_draft from public.tool_drafts where kind = 'teammate' and user_id = :'ben' and status = 'waiting' \gset
select set_config('t.edit', :'edit_draft', false), set_config('t.team', :'team_draft', false);
select t.as_('josh'); set local role authenticated;
select t.ok(not public.settle_tool_draft(current_setting('t.edit')::uuid), 'Josh can''t settle Ben''s draft');
select t.ok(not exists (select 1 from public.tool_drafts where kind = 'teammate'), '... or see it');
reset role; select t.as_('ben'); set local role authenticated;
select t.refused($$select public.approve_tool_draft(current_setting('t.edit')::uuid)$$, 'P0001', 'approve_tool_draft is only for posts and milestones');
select t.ok(public.settle_tool_draft(current_setting('t.edit')::uuid, 'p1'), 'Ben settles the edit once its card saved it');
select t.ok(not public.settle_tool_draft(current_setting('t.edit')::uuid), '... once');
select t.ok(public.dismiss_tool_draft(current_setting('t.team')::uuid), 'Ben dismisses the teammate draft');
reset role;
select t.ok((select status = 'dismissed' from public.tool_drafts where id = :'team_draft'), '... and it stays dismissed');
select t.ok(public.tool_actions_ready(), 'tool_actions_ready()');

select 'tool-actions: all passed' as passed;
rollback;
