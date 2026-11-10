-- Tests for supabase/club-duplicates.sql. Runs in one transaction and rolls back. Needs the e2e seed
-- (Rocketry Club and Robotics Society exist).
\set QUIET on
begin;
create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
select id as cara from auth.users where email = 'cara@forge.test' \gset

insert into public.communities (id, name, type, privacy, owner_id) values ('dup1', 'The Rocketry Club!', 'project', 'public', :'cara');
select t.ok((select count(*) = 1 from public.admin_queue where kind = 'duplicate_club' and subject_id = 'dup1' and detail like '%Rocketry Club%'), 'a near-identical name is flagged, naming the existing club');
insert into public.communities (id, name, type, privacy, owner_id) values ('dup2', 'Quantum Computing Circle', 'project', 'public', :'cara');
select t.ok((select count(*) = 0 from public.admin_queue where kind = 'duplicate_club' and subject_id = 'dup2'), 'a different club isn''t');
select t.ok(public.club_name_key('NSBE Chapter at the University of Hartford') = public.club_name_key('NSBE hartford'), 'filler words don''t count');
rollback;
\echo 'club-duplicate tests: all passed'
