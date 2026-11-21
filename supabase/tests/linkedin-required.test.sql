-- Tests for supabase/linkedin-required.sql, as changed by linkedin-optional.sql (step 87): the LinkedIn
-- profile link is optional for everyone. Signing up doesn't need one (a wrong one is refused); asking
-- for a signature doesn't either, by any route; the link has one shape; anyone can remove theirs;
-- and it is private (nobody else reads it, nobody writes it directly).
-- Rolls back.
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
create function t.oauth(email text) returns uuid language sql as $$
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values (gen_random_uuid(), 'authenticated', 'authenticated', email, now(),
          '{"provider": "linkedin_oidc", "providers": ["linkedin_oidc"]}', jsonb_build_object('name', 'Pat Okoro', 'email', email, 'email_verified', true))
  returning id
$$;
create function t.as_(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset

-- The link has one shape, whatever was pasted.
select t.ok(public.linkedin_clean('linkedin.com/in/pat-okoro') = 'https://www.linkedin.com/in/pat-okoro', 'a bare link is completed');
select t.ok(public.linkedin_clean('  https://www.linkedin.com/in/pat-okoro/  ') = 'https://www.linkedin.com/in/pat-okoro', 'spaces and the trailing slash go');
select t.ok(public.linkedin_clean('https://uk.linkedin.com/in/Pat_Okoro-91?utm_source=share&trk=x') = 'https://www.linkedin.com/in/Pat_Okoro-91', 'a country subdomain and tracking go');
select t.ok(public.linkedin_clean('HTTP://LinkedIn.com/in/r%C3%A9mi-b#about') = 'https://www.linkedin.com/in/r%C3%A9mi-b', 'an encoded name is kept');
select t.ok(public.linkedin_clean('') is null and public.linkedin_clean(null) is null, 'empty means none');
select t.must_fail($$select public.linkedin_clean('https://www.linkedin.com/company/acme')$$, 'LinkedIn profile link');
select t.must_fail($$select public.linkedin_clean('https://evil.example/linkedin.com/in/pat-okoro')$$, 'LinkedIn profile link');
select t.must_fail($$select public.linkedin_clean('https://linkedin.com.evil.example/in/pat-okoro')$$, 'LinkedIn profile link');
select t.must_fail($$select public.linkedin_clean('https://www.linkedin.com/in/pat-okoro/overlay/contact-info')$$, 'LinkedIn profile link');
select t.must_fail($$select public.linkedin_clean('javascript:alert(1)//linkedin.com/in/pat')$$, 'LinkedIn profile link');
select t.must_fail($$select public.linkedin_clean('pat okoro')$$, 'LinkedIn profile link');

-- Finishing sign-up as a professional: the link is optional, but a wrong one stops it.
select t.oauth('pat@voltline.example') as pat \gset
select t.as_(:'pat'); set local role authenticated;
select t.must_fail($$select public.finish_signup('professional', 'Pat', 'Okoro', '1996-03-12', 'twitter.com/pat')$$, 'LinkedIn profile link');
reset role;
select t.ok(not exists (select 1 from public.profiles where id = :'pat'), 'a refused sign-up makes no profile');
select t.as_(:'pat'); set local role authenticated;
select public.finish_signup('professional', 'Pat', 'Okoro', '1996-03-12', 'www.linkedin.com/in/pat-okoro/');
select t.ok(not public.needs_linkedin(), 'a professional who signed up with a link owes nothing');
select t.ok(public.my_linkedin() = 'https://www.linkedin.com/in/pat-okoro', 'they read their own link, cleaned');
reset role;
select t.oauth('sky@voltline.example') as sky \gset
select t.as_(:'sky'); set local role authenticated;
select public.finish_signup('professional', 'Sky', 'Adu', '1993-07-01', '');
select t.ok(not public.needs_linkedin(), 'a professional may sign up without one, and owes nothing (optional, step 87)');
reset role;
select t.ok((select account_type = 'professional' and linkedin_url is null from public.profiles where id = :'sky'), 'their profile exists, with no link');
-- The other sign-up rules still hold through the five-argument form.
select t.oauth('young@voltline.example') as young \gset
select t.as_(:'young'); set local role authenticated;
select t.must_fail($$select public.finish_signup('professional', 'Y', 'Z', (now() - interval '16 years')::date::text, 'linkedin.com/in/young-z')$$, 'at least 18');
reset role;
select t.ok((select account_type = 'professional' and linkedin_url = 'https://www.linkedin.com/in/pat-okoro' from public.profiles where id = :'pat'), 'the profile holds the link');

-- A student isn't asked, at sign-up or after, and may add one or take it away.
select t.oauth('kim@hartford.edu') as kim \gset
select t.as_(:'kim'); set local role authenticated;
select public.finish_signup('student', 'Kim', 'Lee', '2004-02-02', '');
select t.ok(not public.needs_linkedin(), 'a student owes nothing');
select t.ok(public.set_linkedin('linkedin.com/in/kim-lee') = 'https://www.linkedin.com/in/kim-lee', 'a student may add one');
select t.ok(public.set_linkedin('') is null, 'and remove it');
select t.ok(public.my_linkedin() is null, 'then there is none');
reset role;

-- Asking for a signature. Ben logs a milestone with proof; as a student he may ask.
select t.as_(:'ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence)
values ('p1', null, 'Thrust stand reads within 2%', 'Calibrated against reference weights', 'https://github.com/acme/rig/pull/9');
reset role;
select id as ms from public.milestones where title = 'Thrust stand reads within 2%' \gset
select set_config('t.ms', :'ms', false);
select t.as_(:'ben'); set local role authenticated;
select t.ok(not public.needs_linkedin(), 'Ben, a student, owes nothing');
select t.ok(public.request_vouch(current_setting('t.ms'), 'prof.lee@hartford.edu', 'professor', repeat('1', 64)) > 0, 'a student asks with no LinkedIn link');
reset role;

-- He finishes school and switches to Working: now an ask needs the link first.
update auth.users set email = 'ben@example.com' where id = :'ben';
select t.as_(:'ben'); set local role authenticated;
select public.set_account_type('professional');
select t.ok(not public.needs_linkedin(), 'now working, with no link: he still owes nothing (optional)');
select t.ok(public.request_vouch(current_setting('t.ms'), 'dr.kim@hartford.edu', 'mentor', repeat('4', 64)) > 0, 'a working account with no link asks (optional)');
select t.must_fail($$select public.set_linkedin('not a link')$$, 'LinkedIn profile link');
select t.ok(public.my_linkedin() is null, 'a refused link changes nothing');
select t.ok(public.set_linkedin('https://www.linkedin.com/in/ben-cho') = 'https://www.linkedin.com/in/ben-cho', 'he adds it');
select t.ok(public.my_linkedin() = 'https://www.linkedin.com/in/ben-cho', 'it is saved, cleaned');
select t.ok(public.request_vouch(current_setting('t.ms'), 'dr.ruiz@hartford.edu', 'mentor', repeat('2', 64)) > 0, 'with the link, the ask goes out');
select t.ok(public.set_linkedin('linkedin.com/in/ben-cho-ee') = 'https://www.linkedin.com/in/ben-cho-ee', 'he can change it');
select t.ok(public.set_linkedin('') is null, 'he can remove it, even after asking someone to sign (optional)');
select t.ok(public.set_linkedin('linkedin.com/in/ben-cho-ee') = 'https://www.linkedin.com/in/ben-cho-ee', 'and add it back');
reset role;
-- No rule on the table any more (step 87): nothing refuses an ask for a missing link.
select t.ok(not exists (select 1 from pg_trigger where tgname = 'vouch_needs_linkedin'), 'the asks table has no LinkedIn rule');
-- A working account that has asked nobody may still take its link away.
select t.as_(:'pat'); set local role authenticated;
select t.ok(public.set_linkedin('') is null, 'a working account with no asks can remove its link');
reset role;
select t.as_(:'ben'); set local role authenticated;

-- Private: he can't write the column directly, and nobody else can read it.
select t.must_fail($$update public.profiles set linkedin_url = 'https://www.linkedin.com/in/someone-else' where id = auth.uid()$$, 'permission denied');
reset role;
select t.as_(:'josh'); set local role authenticated;
select t.must_fail(format($$select linkedin_url from public.profiles where id = %L$$, :'ben'), 'permission denied');
select t.must_fail($$select * from public.profiles limit 1$$, 'permission denied');
select t.ok(public.my_linkedin() is distinct from 'https://www.linkedin.com/in/ben-cho-ee', 'my_linkedin() is only ever your own');
reset role;

-- Signed out: nothing.
set local role anon;
select t.must_fail($$select public.set_linkedin('linkedin.com/in/anon')$$, 'permission denied');
select t.must_fail($$select public.needs_linkedin()$$, 'permission denied');
select t.must_fail($$select public.my_linkedin()$$, 'permission denied');
select t.must_fail($$select public.finish_signup('professional', 'A', 'B', '1990-01-01', 'linkedin.com/in/a-b')$$, 'permission denied');
reset role;

\echo 'linkedin-required: all passed'
rollback;
