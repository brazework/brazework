-- Tests for supabase/account-type.sql: a member switches Studying ↔ Working for themselves only;
-- studying and working are separate from verified student pricing. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben finishes school, switches to Working and later switches back.
select account_type as josh_before from public.profiles where id = :'josh' \gset
update auth.users set email = 'ben@example.com' where id = :'ben';
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_account_type('professional');
reset role;
select t.ok((select account_type = 'professional' from public.profiles where id = :'ben'), 'a member switches to Working');
select t.ok((select account_type = :'josh_before' from public.profiles where id = :'josh'), 'nobody else changes');

select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_account_type('student');
select t.ok(not public.student_plus_eligible(), 'personal email does not qualify for student pricing');
select t.refused($$select public.set_account_type('admin')$$, 'P0001', 'only Studying or Working');
reset role;

update auth.users set email_change = 'ben@uni.edu' where id = :'ben';
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select t.ok(not public.student_plus_eligible(), 'a pending school email cannot unlock the price');
reset role;

update auth.users set email = 'ben@uni.edu', email_confirmed_at = null where id = :'ben';
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select t.ok(not public.student_plus_eligible(), 'an unconfirmed school address cannot unlock the price');
reset role;

update auth.users set email_confirmed_at = now() where id = :'ben';
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_account_type('student');
select t.ok(public.student_plus_eligible(), 'a confirmed school email qualifies for the discount');
reset role;
select t.ok((select account_type = 'student' from public.profiles where id = :'ben'), 'with a university email, back to Studying');
select t.ok((select owner_id = :'ben' from public.projects where id = 'p1'), 'the member still owns their project after the address changes');
select t.ok((select owner_id = :'ben' from public.milestones where id = 'm1'), 'the member keeps their milestone after the address changes');

set local role anon;
select t.refused($$select public.set_account_type('professional')$$, '42501', 'signed-out callers can''t call it');
reset role;

\echo 'account-type: all passed'
rollback;
