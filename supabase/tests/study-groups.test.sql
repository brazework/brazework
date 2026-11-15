-- Tests for supabase/study-groups.sql: a study group keeps its course, term and meeting time; members
-- confirm who led it (never themselves, never from outside the group, never for a non-member); a
-- confirmation can be taken back; only study groups take confirmations; nobody writes them directly.
-- Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.josh', :'josh', false);

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

-- Ben starts a CHEM 201 study group and sets when it meets; Maya joins.
select t.as_('ben'); set local role authenticated;
select public.create_community('CHEM 201 Study Group T', 'Problem sets together.', 'Chemistry', 'study', 'public', '{}', '') as sg \gset
select set_config('t.sg', :'sg', false);
update public.communities set course = 'CHEM 201', term = 'Spring 2027', meets = 'Tuesdays 7pm, Library 3' where id = :'sg';
select t.as_('maya');
insert into public.community_members (community_id, uid) values (:'sg', auth.uid());
reset role;
select t.ok((select course = 'CHEM 201' and term = 'Spring 2027' and meets <> '' from public.communities where id = :'sg'), 'the group keeps its course, term and meeting time');

select t.as_('maya'); set local role authenticated;
-- The update policy filters the row out rather than raising, so this changes nothing (checked below).
update public.communities set course = 'HACKED' where id = :'sg';
select public.confirm_study_lead(:'sg', :'ben');
select public.confirm_study_lead(:'sg', :'ben'); -- twice is still once
select t.refused(format($$select public.confirm_study_lead(%L, %L)$$, :'sg', :'maya'), 'P0001', 'nobody confirms themselves');
select t.refused(format($$select public.confirm_study_lead(%L, %L)$$, :'sg', :'josh'), 'P0001', 'only members can be confirmed as leaders');
select t.refused(format($$insert into public.study_leads (community_id, leader, confirmed_by) values (%L, %L, %L)$$, :'sg', :'maya', :'ben'), '42501', 'nobody writes confirmations directly');
reset role;
select t.ok((select course = 'CHEM 201' from public.communities where id = :'sg'), 'a plain member can''t change the course');
select t.ok((select count(*) = 1 from public.study_leads where community_id = :'sg' and leader = :'ben' and confirmed_by = :'maya'), 'a member confirms who led the group, once');

-- Josh isn't in the group: he can see the proof but not add to it.
select t.as_('josh'); set local role authenticated;
select t.refused(format($$select public.confirm_study_lead(%L, %L)$$, :'sg', :'ben'), '42501', 'outsiders can''t confirm');
select t.ok((select count(*) = 1 from public.study_leads where leader = :'ben' and community_id = current_setting('t.sg')), 'signed-in members can see the proof');
-- Only study groups take confirmations.
select public.create_community('Not A Study Group T', 'Rockets.', 'Engineering', 'project', 'public', '{}', '') as pg \gset
select t.refused(format($$select public.confirm_study_lead(%L, %L)$$, :'pg', :'ben'), 'P0001', 'only study groups take confirmations');
reset role;

-- Maya takes it back.
select t.as_('maya'); set local role authenticated;
select public.unconfirm_study_lead(:'sg', :'ben');
reset role;
select t.ok((select count(*) = 0 from public.study_leads where community_id = :'sg'), 'a confirmation can be taken back');

-- Signed out: no confirmations.
set local role anon;
select t.refused(format($$select public.confirm_study_lead(%L, %L)$$, :'sg', :'ben'), '42501', 'signed-out visitors can''t confirm');
reset role;

rollback;
\echo 'study-groups tests: all passed'
