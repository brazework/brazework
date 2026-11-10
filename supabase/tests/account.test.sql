-- Tests for supabase/account.sql (rolled back at the end).
\set QUIET on
begin;
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.cara', :'cara', false), set_config('t.ben', :'ben', false);
create schema t; grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.must_fail(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then raise exception 'FAILED: expected "%" but got "%"', needle, sqlerrm; end if; return;
  end;
  raise exception 'FAILED: expected an error ("%") for: %', needle, q;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant execute on all functions in schema t to authenticated;

-- Cara posts, and her milestone has a log entry by Ben (as an officer of Robotics Society, say).
select t.as_('cara'); set local role authenticated;
insert into public.posts (body, kind) values ('Cara was here', 'update');
insert into public.projects (title, summary) values ('Bridge', 'Truss bridge');
reset role;
insert into public.verification_events (milestone_id, actor_id, action, note) values ('m-x', current_setting('t.cara')::uuid, 'approved', 'from Cara');

select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.delete_my_account('delete')$$, 'Type DELETE');
reset role; select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.delete_my_account('DELETE')$$, 'Hand off these clubs first');
reset role; select t.as_('cara'); set local role authenticated;
select public.delete_my_account('DELETE');
reset role;
select t.ok((select count(*) = 0 from auth.users where id = current_setting('t.cara')::uuid), 'the login is gone');
select t.ok((select count(*) = 0 from public.profiles where id = current_setting('t.cara')::uuid), 'the profile is gone');
select t.ok((select count(*) = 0 from public.posts where body = 'Cara was here'), 'her posts are gone');
select t.ok((select count(*) = 0 from public.projects where title = 'Bridge'), 'her projects are gone');
select t.ok((select actor_id is null from public.verification_events where milestone_id = 'm-x'), 'the verification log keeps the record, anonymized');
rollback;
\echo 'account tests: all passed'
