-- Tests for supabase/club-projects.sql (Linear FIX-264): club owners and admins start and run club
-- projects; teammates build on them like on a personal project; a private one stays with its team and
-- the club's leads. Runs in one transaction and rolls back. Needs the e2e seed (Rocketry Club "rkt":
-- Ben owns it, Maya is an admin, Josh is a member; Cara isn't in it).
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.josh', :'josh', false), set_config('t.cara', :'cara', false);

create schema t;
grant usage on schema t to authenticated;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.refused(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when insufficient_privilege or check_violation then return true; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant execute on all functions in schema t to authenticated;
grant select on all tables in schema t to authenticated;

set local role authenticated;

-- Starting one.
select t.as_('josh');
select t.ok(t.refused($q$insert into public.projects (title, summary, community_id) values ('Josh''s', 'x', 'rkt')$q$), 'a plain club member can''t start a club project');
select t.as_('cara');
select t.ok(t.refused($q$insert into public.projects (title, summary, community_id) values ('Cara''s', 'x', 'rkt')$q$), 'someone outside the club can''t either');
select t.as_('maya');
insert into public.projects (id, title, summary, community_id, private) values ('cp1', 'Club rocket L2', 'The club''s Level 2 build.', 'rkt', true);
select t.ok((select community_id = 'rkt' and owner_id = current_setting('t.maya')::uuid from public.projects where id = 'cp1'), 'a club admin starts one, and it''s the club''s');
insert into public.project_details (project_id, details, link) values ('cp1', 'Notes', '');

-- The club's owner runs it too, without being added.
select t.as_('ben');
select t.ok(public.project_role('cp1', current_setting('t.ben')::uuid) = 'admin', 'the club owner counts as a project admin');
select t.ok(public.can_read_project('cp1'), 'the club owner sees the private club project');
update public.projects set summary = 'Level 2 cert flight.' where id = 'cp1';
select t.ok((select summary from public.projects where id = 'cp1') = 'Level 2 cert flight.', 'the club owner edits it');
update public.project_details set details = 'Motor: J350' where project_id = 'cp1';
select t.ok((select details from public.project_details where project_id = 'cp1') = 'Motor: J350', 'the club owner edits the write-up');
insert into public.project_members (project_id, uid, role) values ('cp1', current_setting('t.josh')::uuid, 'member');
select t.ok(exists (select 1 from public.project_members where project_id = 'cp1' and uid = current_setting('t.josh')::uuid), 'the club owner adds a teammate');

-- A teammate builds on it like on a personal project, but doesn't run it.
select t.as_('josh');
select t.ok(public.can_read_project('cp1'), 'the teammate sees it while it''s private');
select t.ok(public.am_on_project_team('cp1'), 'the teammate can add files');
select t.ok(not t.refused($q$insert into public.posts (body, project_id, kind) values ('Nose cone printed', 'cp1', 'project')$q$), 'the teammate posts an update');
insert into public.project_files (project_id, kind, name, path, size) values ('cp1', 'file', 'nose.stl', 'cp1/nose.stl', 1000);
select t.ok(exists (select 1 from public.project_files where project_id = 'cp1' and name = 'nose.stl'), 'the teammate adds a 3D model, as on a personal project');
select t.ok(public.project_file_access((select id from public.project_files where path = 'cp1/nose.stl')) = 'download', 'the teammate who added it may open the original');
update public.projects set summary = 'Hijacked' where id = 'cp1';
select t.ok((select summary from public.projects where id = 'cp1') = 'Level 2 cert flight.', 'a teammate can''t edit the project itself');
delete from public.projects where id = 'cp1';
select t.ok(exists (select 1 from public.projects where id = 'cp1'), 'or delete it');

-- Outside the team and the club's leads: the card only, while it's private.
select t.as_('cara');
select t.ok(exists (select 1 from public.projects where id = 'cp1'), 'the card still shows');
select t.ok(not public.can_read_project('cp1'), 'but the private project doesn''t open');
select t.ok(not exists (select 1 from public.project_details where project_id = 'cp1'), 'nor its write-up');
select t.ok(not exists (select 1 from public.posts where project_id = 'cp1'), 'nor its updates');
update public.projects set private = false where id = 'cp1';
select t.as_('maya');
select t.ok((select private from public.projects where id = 'cp1'), 'an outsider can''t make it public');
update public.projects set private = false where id = 'cp1';
select t.as_('cara');
select t.ok(public.can_read_project('cp1'), 'once a club admin makes it public, everyone sees it');
select t.ok(public.project_file_access((select id from public.project_files where path = 'cp1/nose.stl')) = 'view', 'but its 3D model is view-only for them, as on a personal project');
select t.ok(not public.am_on_project_team('cp1'), 'and they can''t add files');

-- Personal projects are unchanged: the club's leads get nothing on Ben's own project.
select t.as_('maya');
update public.projects set summary = 'Not mine' where id = 'p1';
select t.ok((select summary from public.projects where id = 'p1') <> 'Not mine', 'club admins can''t edit a member''s personal project');
select t.ok(public.project_role('p1', current_setting('t.maya')::uuid) is null, 'nor count on its team');

-- A club admin can delete a club project.
delete from public.projects where id = 'cp1';
select t.ok(not exists (select 1 from public.projects where id = 'cp1'), 'a club admin deletes it');
reset role;

\echo 'club-projects: all passed'
rollback;
