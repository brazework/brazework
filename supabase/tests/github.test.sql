-- Tests for supabase/github.sql: a project's GitHub events are seen exactly by who can see the
-- project; members can't write repo links or events (only the server can, after checking GitHub's
-- signature or the member's GitHub sign-in); installations are private to who installed them; the
-- same thing on GitHub is one entry, however often it arrives. Runs in one transaction; rolls back.
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
create function t.refused(call text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when insufficient_privilege then raise notice 'ok: %', what;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- As the server would: Ben installed the App and linked ben/test-stand to his public project p1
-- and to a private project of his; GitHub reported a merged pull request on it.
insert into public.projects (id, owner_id, title, summary, private) values ('benpriv', :'ben', 'Secret rig', 'Private.', true);
insert into public.github_installations (installation_id, account_login, installed_by) values (9001, 'bencho', :'ben');
insert into public.project_repos (project_id, installation_id, repo_id, full_name, html_url, linked_by) values
  ('p1', 9001, 77, 'bencho/test-stand', 'https://github.com/bencho/test-stand', :'ben'),
  ('benpriv', 9001, 77, 'bencho/test-stand', 'https://github.com/bencho/test-stand', :'ben');
insert into public.build_events (project_id, repo_id, kind, title, url, actor, occurred_at, source_id) values
  ('p1', 77, 'pr_merged', 'Merged #42: Add igniter sequencing', 'https://github.com/bencho/test-stand/pull/42', 'bencho', now(), 'pr:42'),
  ('benpriv', 77, 'pr_merged', 'Merged #42: Add igniter sequencing', 'https://github.com/bencho/test-stand/pull/42', 'bencho', now(), 'pr:42');

-- The same thing on GitHub, again: still one entry per project.
insert into public.build_events (project_id, repo_id, kind, title, url, occurred_at, source_id)
  values ('p1', 77, 'pr_merged', 'Merged #42 again', 'https://github.com/bencho/test-stand/pull/42', now(), 'pr:42')
  on conflict (project_id, repo_id, source_id) do nothing;
select t.ok((select count(*) from public.build_events where project_id = 'p1' and source_id = 'pr:42') = 1, 'a retried delivery adds nothing');

-- Josh sees the public project's events and repo, never the private one's.
select t.as_('josh'); set local role authenticated;
select t.ok((select count(*) from public.build_events where project_id = 'p1') = 1, 'anyone who can see p1 sees its GitHub activity');
select t.ok((select count(*) from public.project_repos where project_id = 'p1') = 1, 'and which repo it comes from');
select t.ok((select count(*) from public.build_events where project_id = 'benpriv') = 0, 'a private project''s activity stays private');
select t.ok((select count(*) from public.project_repos where project_id = 'benpriv') = 0, 'and so does its repo');
select t.ok((select count(*) from public.github_installations) = 0, 'Josh can''t see Ben''s installation');

-- Members can't write any of it, not even to their own projects.
reset role; select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) from public.build_events where project_id = 'benpriv') = 1, 'Ben sees his private project''s activity');
select t.ok((select count(*) from public.github_installations) = 1, 'and his own installation');
select t.refused($$insert into public.build_events (project_id, repo_id, kind, title, url, occurred_at, source_id) values ('p1', 77, 'release', 'Released v9 (made up)', 'https://github.com/x/y', now(), 'release:1')$$, 'a member can''t invent GitHub activity');
select t.refused($$insert into public.project_repos (project_id, installation_id, repo_id, full_name, html_url) values ('p1', 9001, 78, 'someone/else', 'https://github.com/someone/else')$$, 'or link a repo without the server checking their GitHub access');
select t.refused($$insert into public.github_installations (installation_id, account_login) values (9002, 'someone')$$, 'or claim an installation');
select t.refused($$select * from public.github_deliveries$$, 'webhook deliveries are the server''s');

-- On the team, Josh sees the private project's activity too.
reset role;
insert into public.project_members (project_id, uid) values ('benpriv', :'josh');
select t.as_('josh'); set local role authenticated;
select t.ok((select count(*) from public.build_events where project_id = 'benpriv') = 1, 'a teammate sees a private project''s activity');

-- Deleting the project, or the App being uninstalled, takes its links and events with it.
reset role;
delete from public.projects where id = 'benpriv';
select t.ok(not exists (select 1 from public.build_events where project_id = 'benpriv') and not exists (select 1 from public.project_repos where project_id = 'benpriv'), 'a deleted project''s GitHub links and events go with it');
delete from public.github_installations where installation_id = 9001;
select t.ok(not exists (select 1 from public.project_repos where installation_id = 9001), 'uninstalling the App unlinks its repos');

-- Only https links, and only kinds the log knows.
do $$ begin
  insert into public.build_events (project_id, repo_id, kind, title, url, occurred_at, source_id) values ('p1', 77, 'release', 'x', 'javascript:alert(1)', now(), 'release:2');
  raise exception 'FAILED: a javascript: link was stored';
exception when check_violation then raise notice 'ok: only https links are stored';
end $$;

select t.ok(public.github_ready(), 'the app can tell the step has run');

rollback;
\echo 'github tests: all passed'
