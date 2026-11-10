-- Tests for supabase/school-requests.sql. Runs in one transaction and rolls back. Needs the e2e seed
-- (Maya is a Forge admin; Josh isn't).
\set QUIET on
begin;
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false);
create schema t;
grant usage on schema t to anon, authenticated;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
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
grant execute on all functions in schema t to anon, authenticated;

-- Anyone (not signed in yet) can ask; known schools are already listed.
set local role anon;
select t.ok(public.request_school('hartford.edu', 'University of Hartford') = 'listed', 'an academic domain is already recognized');
select t.ok(public.request_school('sam@CEGEP-Test.qc.ca', 'Test college', 'sam@cegep-test.qc.ca') = 'requested', 'a new school is requested (domain cleaned from an email)');
select t.ok(public.request_school('cegep-test.qc.ca', 'Test college') = 'requested', 'asking again counts up');
select t.must_fail($$select public.request_school('not a domain', 'X college')$$, 'email domain');
select t.must_fail($$select * from public.school_requests$$, 'permission denied');
reset role;
select t.ok((select asks = 2 and status = 'open' from public.school_requests where domain = 'cegep-test.qc.ca'), 'one row per domain, two asks');

-- Only Forge admins decide; adding lists the school, so its students can sign up.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.decide_school_request((select max(id) from public.school_requests), true)$$, 'Forge admins only');
select t.ok((select count(*) = 0 from public.school_requests), 'members can''t read requests');
reset role; select t.as_('maya'); set local role authenticated;
select t.ok(public.decide_school_request((select id from public.school_requests where domain = 'cegep-test.qc.ca'), true) = 'added', 'a Forge admin adds it');
reset role;
select t.ok(public.is_school_email('sam@cegep-test.qc.ca'), 'and its email now counts as a school email');
rollback;
\echo 'school-request tests: all passed'
