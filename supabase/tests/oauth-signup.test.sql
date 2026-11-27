-- Tests for supabase/oauth-signup.sql: someone who signs up with Google, GitHub or LinkedIn gets no
-- profile until they finish sign-up, and finishing holds them to the email form's rules (old enough,
-- one profile and verified email). Students can use a personal address.
-- Inserts into auth.users the way Supabase Auth does for an OAuth sign-up. Rolls back.
\set QUIET on
begin;
create schema t;
create function t.must_fail(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then raise exception 'FAILED: expected "%" but got "%" for: %', needle, sqlerrm, q; end if;
    return;
  end;
  raise exception 'FAILED: expected an error ("%") for: %', needle, q;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
-- An OAuth newcomer: the provider's profile in the metadata, a verified email, no accountType.
create function t.oauth(email text, confirmed boolean default true) returns uuid language sql as $$
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values (gen_random_uuid(), 'authenticated', 'authenticated', email, case when confirmed then now() end,
          '{"provider": "google", "providers": ["google"]}', jsonb_build_object('full_name', 'Ola Ade', 'email', email, 'email_verified', confirmed))
  returning id
$$;
create function t.as_(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

select t.oauth('ola@gmail.com') as ola \gset
select t.oauth('kim@hartford.edu') as kim \gset
select t.oauth('unverified@gmail.com', false) as unv \gset
select t.ok(not exists (select 1 from public.profiles where id in (:'ola', :'kim', :'unv')), 'an OAuth sign-up makes no profile by itself');

select t.as_(:'ola'); set local role authenticated;
select t.ok(not exists (select 1 from public.profiles where id = auth.uid()), 'until they finish, they have no profile');
select t.must_fail($$insert into public.profiles (id, first_name, last_name, birthday, account_type) values (auth.uid(), 'O', 'A', '1990-01-01', 'professional')$$, 'permission denied');
select t.must_fail($$select public.finish_signup('professional', 'Ola', 'Ade', (now() - interval '16 years')::date::text)$$, 'at least 18');
select t.must_fail($$select public.finish_signup('professional', 'Ola', 'Ade', '')$$, 'Enter your birthday');
select t.must_fail($$select public.finish_signup('professional', 'Ola', 'Ade', 'not a date')$$, 'Enter your birthday');
select t.must_fail($$select public.finish_signup('admin', 'Ola', 'Ade', '2003-01-01')$$, 'student or professional');
select t.must_fail($$select public.finish_signup('professional', ' ', 'Ade', '2003-01-01')$$, 'first and last name');
select t.must_fail($$select public.signup_check('x@gmail.com', 'professional', '2000-01-01')$$, 'permission denied');
select public.finish_signup('student', '  Ola ', 'Ade', '1995-06-30');
select t.ok((select first_name = 'Ola' and last_name = 'Ade' and account_type = 'student' and not onboarded from public.profiles where id = auth.uid()), 'a student with a personal email finishes sign-up, not yet onboarded');
select t.must_fail($$select public.finish_signup('student', 'Ola', 'Ade', '1995-06-30')$$, 'already set up');
select t.must_fail($$update public.profiles set account_type = 'student' where id = auth.uid()$$, 'permission denied');
reset role;
select t.ok((select birthday = '1995-06-30' from public.profiles where id = :'ola'), 'the birthday is stored like the form stores it');

-- A student whose provider account is their school account.
select t.as_(:'kim'); set local role authenticated;
select public.finish_signup('student', 'Kim', 'Lee', '2004-02-02');
reset role;
select t.ok((select account_type = 'student' from public.profiles where id = :'kim'), 'a school-email student finishes sign-up as a student');

-- An email the provider didn't verify can't finish (Supabase normally doesn't sign them in at all).
select t.as_(:'unv'); set local role authenticated;
select t.must_fail($$select public.finish_signup('professional', 'U', 'V', '1990-01-01')$$, 'Confirm your email');
reset role;

-- Signed out: no.
set local role anon;
select t.must_fail($$select public.finish_signup('professional', 'A', 'B', '1990-01-01')$$, 'permission denied');
reset role;

-- The minimum age is the same setting the form uses.
update public.app_config set value = '21' where key = 'min_age';
select t.oauth('young@gmail.com') as young \gset
select t.as_(:'young'); set local role authenticated;
select t.must_fail($$select public.finish_signup('professional', 'Y', 'G', (now() - interval '19 years')::date::text)$$, 'at least 21');
reset role;
update public.app_config set value = '18' where key = 'min_age';

-- The email form still works the same way through the trigger.
insert into auth.users (id, aud, role, email, raw_user_meta_data)
values (gen_random_uuid(), 'authenticated', 'authenticated', 'eli@hartford.edu', '{"accountType": "student", "firstName": "Eli", "lastName": "Ng", "birthday": "2004-01-01"}');
select t.ok(exists (select 1 from public.profiles p join auth.users u on u.id = p.id where u.email = 'eli@hartford.edu' and p.account_type = 'student'), 'email sign-ups still get their profile from the trigger');
select t.must_fail($$insert into auth.users (id, aud, role, email, raw_user_meta_data) values (gen_random_uuid(), 'authenticated', 'authenticated', 'kid@hartford.edu', jsonb_build_object('accountType', 'student', 'firstName', 'K', 'lastName', 'D', 'birthday', (now() - interval '15 years')::date::text))$$, 'at least 18');

rollback;
\echo 'oauth-signup tests: all passed'
