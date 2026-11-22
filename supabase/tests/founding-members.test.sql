-- Tests for supabase/founding-members.sql (step 91, Linear FIX-241): the first 1,000 members get a
-- founding number that never changes. Runs in one transaction and rolls back. Needs the e2e seed (Maya
-- is a Brazework admin; Ben and Josh are members who finished onboarding).
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false);

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

-- ---------- Existing members were numbered when the step ran ----------
select t.ok((select founding_number is not null from public.profiles where id = current_setting('t.ben')::uuid), 'a member who was already here has a number');
select t.ok((select count(*) = count(distinct founding_number) from public.profiles where founding_number is not null), 'no two members share a number');
select t.ok((select min(founding_number) = 1 from public.profiles), 'numbering starts at 1');

-- ---------- A number can't be taken away or changed ----------
update public.profiles set founding_number = null where id = current_setting('t.josh')::uuid;
select t.ok((select founding_number is not null from public.profiles where id = current_setting('t.josh')::uuid), 'a number can''t be taken away');
select set_config('t.bens', (select founding_number::text from public.profiles where id = current_setting('t.ben')::uuid), false);
update public.profiles set founding_number = 999 where id = current_setting('t.ben')::uuid;
select t.ok((select founding_number = current_setting('t.bens')::int from public.profiles where id = current_setting('t.ben')::uuid), 'a number never changes once given');
select t.as_('ben'); set local role authenticated;
select t.must_fail($$update public.profiles set founding_number = 1 where id = auth.uid()$$, 'permission denied');
select t.ok((select founding_number is not null from public.profiles where id = auth.uid()), 'members can read their number');
reset role;

-- ---------- Finishing sign-up gives the next number ----------
-- Josh, as if he were only now finishing onboarding.
alter table public.profiles disable trigger profiles_founding_number;
update public.profiles set founding_number = null, onboarded = false where id = current_setting('t.josh')::uuid;
alter table public.profiles enable trigger profiles_founding_number;
select set_config('t.next', (select coalesce(max(founding_number), 0)::text from public.profiles), false);
update public.profiles set headline = coalesce(headline, '') where id = current_setting('t.josh')::uuid;
select t.ok((select founding_number is null from public.profiles where id = current_setting('t.josh')::uuid), 'no number before onboarding is finished');
update public.profiles set onboarded = true where id = current_setting('t.josh')::uuid;
select t.ok((select founding_number > current_setting('t.next')::int from public.profiles where id = current_setting('t.josh')::uuid), 'finishing onboarding gives the next number, after everyone before');
-- An admin finishing onboarding doesn't take a place. (The e2e seed onboards everyone before Maya
-- becomes an admin, so clear hers first; in production the founders were admins before this step.)
alter table public.profiles disable trigger profiles_founding_number;
update public.profiles set founding_number = null where id = current_setting('t.maya')::uuid;
alter table public.profiles enable trigger profiles_founding_number;
update public.profiles set onboarded = false where id = current_setting('t.maya')::uuid;
update public.profiles set onboarded = true where id = current_setting('t.maya')::uuid;
select t.ok((select founding_number is null from public.profiles where id = current_setting('t.maya')::uuid), 'an admin finishing onboarding stays unnumbered');

-- ---------- After 1,000, no more ----------
alter table public.profiles disable trigger profiles_founding_number;
-- (A sequence isn't rolled back with the test, so it's put back right after.)
select set_config('t.seq', (select last_value::text || '|' || is_called::text from public.founding_number_seq), false);
select setval('public.founding_number_seq', 1000, true);
update public.profiles set founding_number = null, onboarded = false where id = current_setting('t.josh')::uuid;
alter table public.profiles enable trigger profiles_founding_number;
update public.profiles set onboarded = true where id = current_setting('t.josh')::uuid;
select t.ok((select founding_number is null from public.profiles where id = current_setting('t.josh')::uuid), 'once all 1,000 are taken, new members don''t get one');
select t.ok(public.founding_places_left() = 0, 'and no places are left');
select setval('public.founding_number_seq', split_part(current_setting('t.seq'), '|', 1)::bigint, split_part(current_setting('t.seq'), '|', 2)::boolean);

select t.ok(public.founding_members_ready(), 'the app can tell the step has run');

rollback;
\echo 'founding-members tests: all passed'
