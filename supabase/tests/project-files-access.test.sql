-- Tests for supabase/project-files-access.sql: adding to a project's files works for its team again
-- (it failed with "permission denied for function on_project_team"), still not for anyone else, and
-- on_project_team() itself stays private. Runs in one transaction; rolls back.
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
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- Ben owns p1: he can add a link to its files.
select t.as_('ben'); set local role authenticated;
insert into public.project_files (project_id, name, kind, url) values ('p1', 'Test stand drawings', 'link', 'https://example.com/drawings');
select t.ok((select count(*) = 1 from public.project_files where project_id = 'p1' and name = 'Test stand drawings'), 'the project''s owner adds to its files');
select t.ok(public.am_on_project_team('p1'), 'am_on_project_team() says Ben is on p1');

-- Josh isn't on p1: refused by the policy (not by a permission error).
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(not public.am_on_project_team('p1'), 'am_on_project_team() says Josh isn''t on p1');
do $$ begin
  insert into public.project_files (project_id, name, kind, url) values ('p1', 'Not mine', 'link', 'https://example.com/x');
  raise exception 'FAILED: someone off the team added a file';
exception when insufficient_privilege then
  if sqlerrm like '%row-level security%' then raise notice 'ok: someone off the team is refused (%)', sqlerrm; else raise exception 'FAILED: wrong refusal: %', sqlerrm; end if;
end $$;

-- The underlying check stays private: it can answer about anyone.
do $$ begin perform public.on_project_team('p1', current_setting('t.ben')::uuid); raise exception 'FAILED: on_project_team is callable'; exception when insufficient_privilege then raise notice 'ok: on_project_team() stays private'; end $$;

reset role;
select t.ok(public.project_files_access_ready(), 'the app can tell the step has run');

rollback;
\echo 'project-files-access tests: all passed'
