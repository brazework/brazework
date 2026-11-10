-- Tests for supabase/rate-limits.sql, acting as real members. Runs in one transaction and rolls back.
-- Needs the e2e seed (josh, ben, cara; Cara admins the verified company "Acme Aerospace").
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false);

create schema t;
grant usage on schema t to authenticated;
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
grant execute on all functions in schema t to authenticated;

-- Tight limits for the test; everything rolls back.
update public.app_config set value = '2' where key = 'limit_posts_per_hour';
update public.app_config set value = '0' where key = 'limit_org_requests_per_week';
delete from public.conversations where least(user_a, user_b) = least(:'cara'::uuid, :'ben'::uuid) and greatest(user_a, user_b) = greatest(:'cara'::uuid, :'ben'::uuid);
delete from public.posts where author_id = :'josh'::uuid and created_at > now() - interval '1 hour';

select t.as_('josh'); set local role authenticated;
insert into public.posts (body, kind) values ('Pace test one', 'update');
insert into public.posts (body, kind) values ('Pace test two', 'update');
select t.must_fail($$insert into public.posts (body, kind) values ('Pace test three', 'update')$$, 'faster than Forge allows');
select t.ok((select count(*) = 2 from public.posts where body like 'Pace test%'), 'the third post in an hour is refused');

-- A company admin's weekly message requests are capped (here at zero).
reset role; select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.start_conversation(current_setting('t.ben')::uuid)$$, 'weekly message requests are used up');

-- Seeds and admin work (no signed-in member) aren't limited.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.posts (author_id, body, kind) values (:'josh'::uuid, 'Pace test seed', 'update');
select t.ok((select count(*) = 3 from public.posts where body like 'Pace test%'), 'inserts without a member aren''t limited');

rollback;
\echo 'rate-limit tests: all passed'
