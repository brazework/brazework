-- Tests for supabase/playbook-lanes.sql: me says whether the member is studying or working, so an
-- assistant can pick the playbook's part (Studying or Working), and it still returns everything it
-- did before. Also pins what the lanes rely on: a milestone logged from a tool with no club is a
-- hidden draft (the twin of the club case in mcp-milestones.test.sql). One transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.ben', :'ben', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben (owner of project p1): a token that may post.
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Codex', repeat('b', 64), 'forge_bbbbbb', array['read', 'post']) is not null as r1 \gset
reset role;

-- The server calls as anon, with only the token hash.
update public.profiles set account_type = 'professional' where id = :'ben';
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.ok((public.mcp_me(repeat('b', 64))->>'account_type') = 'professional', 'me says the member is working');
select t.ok(public.mcp_me(repeat('b', 64)) ?& array['id', 'name', 'headline', 'field', 'interests', 'profile_url', 'projects', 'verified_milestones', 'clubs', 'unread_notifications'],
  'everything me returned before is still there');
reset role;
update public.profiles set account_type = 'student' where id = :'ben';
set local role anon;
select t.ok((public.mcp_me(repeat('b', 64))->>'account_type') = 'student', 'and follows a change to studying');

-- With no club it waits for a signature, and it is hidden until the member shows it.
select (public.mcp_log_milestone(repeat('b', 64), 'p1', null, 'Rail test passed', '', array['https://github.com/acme/rig/commit/abc1234'])->>'id') as mid \gset
reset role;
select t.ok((select private and status = 'draft' from public.milestones where id = :'mid'), 'a milestone logged with no club is a hidden draft');
select t.ok(public.playbook_lanes_ready(), 'the health check can tell the step has run');

rollback;
\echo 'playbook-lanes tests: all passed'
