-- Tests for supabase/signup-rules.sql: the rules hold for any sign-up, not just the app's form.
-- Inserts into auth.users the way Supabase Auth does, inside a transaction that rolls back.
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
create function t.signup(email text, kind text, bd text) returns void language sql as $$
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values (gen_random_uuid(), 'authenticated', 'authenticated', email, jsonb_build_object('accountType', kind, 'firstName', 'T', 'lastName', 'U', 'birthday', bd))
$$;

select t.must_fail($$select t.signup('kid@uhart.edu', 'student', (now() - interval '15 years')::date::text)$$, 'at least 18');
select t.must_fail($$select t.signup('nobday@uhart.edu', 'student', '')$$, 'Enter your birthday');
select t.must_fail($$select t.signup('student@gmail.com', 'student', '2004-01-01')$$, 'university email');
select t.signup('dana@hartford.edu', 'student', '2004-01-01');
select t.signup('pro@gmail.com', 'professional', '1990-01-01');
select t.ok((select count(*) = 2 from public.profiles p join auth.users u on u.id = p.id where u.email in ('dana@hartford.edu', 'pro@gmail.com')), 'a school-email student and a professional get profiles');

-- A school without an academic domain, once listed.
select t.must_fail($$select t.signup('sam@cegep-test.qc.ca', 'student', '2004-01-01')$$, 'university email');
insert into public.school_domains (domain, school) values ('cegep-test.qc.ca', 'Test college');
select t.signup('sam@cegep-test.qc.ca', 'student', '2004-01-01');
select t.ok(public.is_school_email('sam@mail.cegep-test.qc.ca'), 'subdomains of a listed school count');
select t.ok(not public.is_school_email('sam@notcegep-test.qc.ca'), 'lookalike domains don''t');

-- The minimum age is configurable.
update public.app_config set value = '21' where key = 'min_age';
select t.must_fail($$select t.signup('young@uhart.edu', 'student', (now() - interval '19 years')::date::text)$$, 'at least 21');

rollback;
\echo 'signup-rules tests: all passed'
