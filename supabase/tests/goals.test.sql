-- Tests for supabase/goals.sql: a member sets a goal (one active at a time), others see it only when
-- it's visible, setting a visible internship goal ticks "Open to: internships", reaching it closes it
-- with a note, and nobody writes goals except through the functions. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

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

update public.profiles set open_to = '{}' where id = :'ben';

select t.as_('ben'); set local role authenticated;
select t.refused($$select public.set_goal('fame')$$, 'P0001', 'only known goals');
select t.refused($$select public.set_goal('internship', repeat('x', 81))$$, 'P0001', 'the target stays short');
select public.set_goal('internship', 'power electronics') is not null as g1 \gset
select t.ok((select count(*) = 1 from public.member_goals where uid = auth.uid() and status = 'active' and kind = 'internship' and target = 'power electronics'), 'a member sets a goal');
select t.ok((select 'internships' = any (open_to) from public.profiles where id = auth.uid()), 'an internship goal ticks "Open to: internships"');
select public.set_goal('grad', 'robotics', false) is not null as g2 \gset
select t.ok((select count(*) = 1 from public.member_goals where uid = auth.uid() and status = 'active'), 'one active goal at a time');
select t.ok((select count(*) = 1 from public.member_goals where uid = auth.uid() and status = 'dropped' and kind = 'internship'), 'the old goal is kept, dropped');
select t.refused($$insert into public.member_goals (uid, kind) values (auth.uid(), 'job')$$, '42501', 'nobody writes goals directly');
reset role;

-- A hidden goal is Ben's alone; a visible one anyone signed in can see.
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 0 from public.member_goals where uid = current_setting('t.ben')::uuid and status = 'active'), 'a hidden goal stays hidden');
reset role;
select t.as_('ben'); set local role authenticated;
select public.set_goal('research', 'CRISPR screens') is not null as g3 \gset
reset role;
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 1 from public.member_goals where uid = current_setting('t.ben')::uuid and status = 'active' and kind = 'research'), 'a visible goal shows to other members');
select t.refused($$select public.reach_goal('Got it')$$, 'P0001', 'you can only close your own goal (Maya has none)');
reset role;

select t.as_('ben'); set local role authenticated;
select public.reach_goal('Joined the Ortiz lab for the summer');
select t.ok((select status = 'met' and met_note = 'Joined the Ortiz lab for the summer' and closed_at is not null from public.member_goals where uid = auth.uid() and kind = 'research' order by id desc limit 1), 'reaching a goal closes it with a note');
select t.refused($$select public.reach_goal('')$$, 'P0001', 'no active goal left to reach');
reset role;

set local role anon;
select t.refused($$select count(*) from public.member_goals$$, '42501', 'signed-out visitors can''t read goals');
reset role;

rollback;
\echo 'goal tests: all passed'
