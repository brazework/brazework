-- Tests for supabase/linkedin-optional.sql (step 87): the LinkedIn link is optional. A working account
-- with no link asks a person to sign, by request_vouch() and by a direct insert; needs_linkedin() is
-- false; anyone can remove their link; the link is still private. Rolls back.
\set QUIET on
begin;
create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select t.ok(public.linkedin_optional_ready(), 'the step has run');
select t.ok(not exists (select 1 from pg_trigger where tgname = 'vouch_needs_linkedin'), 'no LinkedIn rule on the asks table');

-- Ben is a working account with no link and a milestone with proof.
update public.profiles set account_type = 'professional', linkedin_url = null where id = :'ben';
update auth.users set email = 'ben@example.com' where id = :'ben';
select t.as_(:'ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence)
values ('p1', null, 'Optional link check', '', 'https://github.com/acme/rig/pull/10');
reset role;
select id as ms from public.milestones where title = 'Optional link check' \gset
select set_config('t.ms', :'ms', false);
select t.as_(:'ben'); set local role authenticated;
select t.ok(not public.needs_linkedin(), 'a working account with no link owes nothing');
select t.ok(public.request_vouch(current_setting('t.ms'), 'dr.lee@hartford.edu', 'mentor', repeat('5', 64)) > 0, 'and asks someone to sign');
select t.ok(public.set_linkedin('linkedin.com/in/ben-cho') = 'https://www.linkedin.com/in/ben-cho', 'may add a link');
select t.ok(public.set_linkedin('') is null, 'and remove it after asking');
reset role;
insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash)
values (:'ms', :'ben', 'x@hartford.edu', 'other', repeat('6', 64));
select t.ok(exists (select 1 from public.milestone_vouches where token_hash = repeat('6', 64)), 'a direct insert is not refused either');

-- Still private.
select t.as_(:'josh'); set local role authenticated;
select t.ok((select count(*) from information_schema.column_privileges where table_name = 'profiles' and column_name = 'linkedin_url' and grantee in ('authenticated', 'anon')) = 0, 'nobody is granted the column');
reset role;
set local role anon;
do $$ begin perform public.needs_linkedin(); raise exception 'FAILED: anon called needs_linkedin'; exception when insufficient_privilege then raise notice 'ok: signed out, nothing'; end $$;
reset role;

\echo 'linkedin-optional: all passed'
rollback;
