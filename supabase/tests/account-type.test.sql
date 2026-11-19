-- Tests for supabase/account-type.sql: a member switches Studying ↔ Working for themselves only;
-- becoming a student needs a university email, as at sign-up; nothing else is accepted. Rolls back.
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

-- Ben finishes school: he switches to Working, and back is held to the university-email rule.
select account_type as josh_before from public.profiles where id = :'josh' \gset
update auth.users set email = 'ben@example.com' where id = :'ben';
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_account_type('professional');
reset role;
select t.ok((select account_type = 'professional' from public.profiles where id = :'ben'), 'a member switches to Working');
select t.ok((select account_type = :'josh_before' from public.profiles where id = :'josh'), 'nobody else changes');

select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select t.refused($$select public.set_account_type('student')$$, 'P0001', 'Studying needs a university email');
select t.refused($$select public.set_account_type('admin')$$, 'P0001', 'only Studying or Working');
reset role;

update auth.users set email = 'ben@uni.edu' where id = :'ben';
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_account_type('student');
reset role;
select t.ok((select account_type = 'student' from public.profiles where id = :'ben'), 'with a university email, back to Studying');

set local role anon;
select t.refused($$select public.set_account_type('professional')$$, '42501', 'signed-out callers can''t call it');
reset role;

\echo 'account-type: all passed'
rollback;
