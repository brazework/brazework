-- Tests for supabase/linkedin-public.sql: a member's LinkedIn stays private unless they choose to show
-- it on their profile. Runs in one transaction and rolls back. Needs the e2e seed (Ben and Josh).
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false);

create schema t;
grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant execute on all functions in schema t to authenticated;

set local role authenticated;
select t.as_('ben');
select public.set_linkedin('linkedin.com/in/ben-test-e2e');
select t.ok(not public.my_linkedin_public(), 'the switch starts off: the link stays private');
select t.ok(public.profile_linkedin(current_setting('t.ben')::uuid) is null, 'its owner sees nothing yet, as visitors do');
select t.as_('josh');
select t.ok(public.profile_linkedin(current_setting('t.ben')::uuid) is null, 'another member doesn''t see it by default');

select t.as_('ben');
select public.set_linkedin_public(true);
select t.ok(public.my_linkedin_public(), 'the switch turns on');
select t.as_('josh');
select t.ok(public.profile_linkedin(current_setting('t.ben')::uuid) = 'https://www.linkedin.com/in/ben-test-e2e', 'once on, another member sees the cleaned link');

-- The switch is the owner's alone: Josh's own doesn't touch Ben's.
select public.set_linkedin_public(false);
select t.ok(public.profile_linkedin(current_setting('t.ben')::uuid) is not null, 'one member''s switch doesn''t change another''s');

select t.as_('ben');
select public.set_linkedin_public(false);
select t.as_('josh');
select t.ok(public.profile_linkedin(current_setting('t.ben')::uuid) is null, 'turned back off, nobody sees it');

reset role;
update public.profiles set linkedin_url = null, linkedin_public = true where id = current_setting('t.josh')::uuid;
set local role authenticated;
select t.as_('ben');
select t.ok(public.profile_linkedin(current_setting('t.josh')::uuid) is null, 'on with no link shows nothing');

-- The columns stay unreadable and unwritable directly.
select t.ok(not has_column_privilege('authenticated', 'public.profiles', 'linkedin_public', 'SELECT'), 'the switch column isn''t granted to members');
select t.ok(not has_column_privilege('authenticated', 'public.profiles', 'linkedin_public', 'UPDATE'), 'members can''t write the switch directly');
select t.ok(not has_column_privilege('authenticated', 'public.profiles', 'linkedin_url', 'SELECT'), 'the link column itself stays ungranted');

-- Signed out sees nothing.
reset role;
select t.ok(not has_function_privilege('anon', 'public.profile_linkedin(uuid)', 'EXECUTE'), 'signed-out visitors can''t read it');

echo 'linkedin-public: all passed'
rollback;
