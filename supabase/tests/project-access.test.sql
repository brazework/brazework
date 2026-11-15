-- Tests for supabase/project-access.sql (step 55): a private project's updates and write-up are hidden
-- from everyone but the people on it; owners, admins and teammates post on it, viewers only look; the
-- owner and admins manage the team, but only the owner makes admins; making it public shows it all.
-- Runs in one transaction; rolls back.
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
-- Whether a statement is refused (runs as the caller).
create function t.refused(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- Ben's private build. Josh is a teammate, Maya a viewer; Cara isn't on it.
insert into public.projects (id, owner_id, title, summary, private) values ('pa1', :'ben', 'Stealth rover', 'Not ready yet.', true);
insert into public.project_details (project_id, details) values ('pa1', 'The full write-up.');
insert into public.project_members (project_id, uid, role) values ('pa1', :'josh', 'member'), ('pa1', :'maya', 'viewer');

-- ---------- Who can post on it ----------
select t.as_('ben'); set local role authenticated;
select t.ok(not t.refused($q$insert into public.posts (body, project_id, kind) values ('Owner update', 'pa1', 'project')$q$), 'the owner posts an update');
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(not t.refused($q$insert into public.posts (body, project_id, kind) values ('Teammate update', 'pa1', 'project')$q$), 'a teammate posts an update');
reset role; select t.as_('maya'); set local role authenticated;
select t.ok(t.refused($q$insert into public.posts (body, project_id, kind) values ('Viewer update', 'pa1', 'project')$q$), 'a viewer can''t post on it');
reset role; select t.as_('cara'); set local role authenticated;
select t.ok(t.refused($q$insert into public.posts (body, project_id, kind) values ('Stranger update', 'pa1', 'project')$q$), 'someone not on it can''t post on it');

-- ---------- Who can see it while it's private ----------
select t.ok((select count(*) from public.posts where project_id = 'pa1') = 0, 'its updates are hidden from someone not on it');
select t.ok((select count(*) from public.project_details where project_id = 'pa1') = 0, 'so is its write-up');
select t.ok(not public.can_read_project('pa1'), 'they can''t read the project');
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) from public.posts where project_id = 'pa1') = 2, 'a viewer sees both updates');
select t.ok((select count(*) from public.project_details where project_id = 'pa1') = 1, 'and the write-up');
select t.ok(public.project_role('pa1', auth.uid()) = 'viewer', 'project_role() says viewer');
select t.ok(not public.am_on_project_team('pa1'), 'a viewer can''t upload files');

-- ---------- Managing the team ----------
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(t.refused(format($q$insert into public.project_members (project_id, uid, role) values ('pa1', %L, 'viewer')$q$, :'cara')), 'a teammate can''t add people');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok(not t.refused(format($q$update public.project_members set role = 'admin' where project_id = 'pa1' and uid = %L$q$, :'josh')), 'the owner makes a teammate an admin');
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(not t.refused(format($q$insert into public.project_members (project_id, uid, role) values ('pa1', %L, 'viewer')$q$, :'cara')), 'an admin adds a viewer');
select t.ok((select count(*) from public.project_members where project_id = 'pa1' and uid = :'cara') = 1, 'and they''re on it');
select t.ok((select count(*) from public.posts where project_id = 'pa1') = 2, 'an admin sees the updates');
select t.ok(t.refused(format($q$update public.project_members set role = 'admin' where project_id = 'pa1' and uid = %L$q$, :'maya')), 'an admin can''t make someone an admin');
select t.ok((select role from public.project_members where project_id = 'pa1' and uid = :'maya') = 'viewer', 'so they''re still a viewer');
select t.ok(t.refused(format($q$insert into public.project_members (project_id, uid, role) values ('pa1', %L, 'admin')$q$, :'ben')), 'an admin can''t add an admin');
delete from public.project_members where project_id = 'pa1' and uid = :'maya';
select t.ok((select count(*) from public.project_members where project_id = 'pa1' and uid = :'maya') = 0, 'an admin removes a viewer');

-- ---------- Making it public ----------
reset role; select t.as_('ben'); set local role authenticated;
update public.projects set private = false where id = 'pa1';
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) from public.posts where project_id = 'pa1') = 2, 'once public, everyone sees its updates');
select t.ok((select count(*) from public.project_details where project_id = 'pa1') = 1, 'and its write-up');
select t.ok(t.refused($q$insert into public.posts (body, project_id, kind) values ('Still not mine', 'pa1', 'project')$q$), 'being able to see it still doesn''t let you post on it');

reset role;
select t.ok(public.project_access_ready(), 'the app can tell the step has run');

rollback;
\echo 'project-access tests: all passed'
