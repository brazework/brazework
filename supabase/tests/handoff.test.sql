-- Tests for supabase/club-handoff.sql, as real members (rolled back at the end).
-- Seed: Rocketry Club "rkt": ben owner, maya admin, josh member; cara not in it.
\set QUIET on
begin;
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false), set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false);
create schema t; grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.must_fail(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then raise exception 'FAILED: expected "%" but got "%" for: %', needle, sqlerrm, q; end if; return;
  end;
  raise exception 'FAILED: expected an error ("%") for: %', needle, q;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant execute on all functions in schema t to authenticated;
create temp table before as select (select count(*) from public.posts where community_id = 'rkt') posts, (select count(*) from public.community_members where community_id = 'rkt') members;
grant select on before to authenticated;

select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.hand_off_role('rkt', current_setting('t.cara')::uuid)$$, 'Only officers');
reset role; select t.as_('maya'); set local role authenticated;
select t.must_fail($$select public.hand_off_role('rkt', current_setting('t.cara')::uuid)$$, 'need to be in the club');
select t.must_fail($$select public.hand_off_role('rkt', current_setting('t.maya')::uuid)$$, 'Pick someone else');
select t.must_fail($$select public.hand_off_role('rkt', current_setting('t.ben')::uuid)$$, 'already hold this role or a higher one');

-- The owner graduates and hands the club to Josh.
reset role; select t.as_('ben'); set local role authenticated;
select public.hand_off_role('rkt', current_setting('t.josh')::uuid, 'Graduating; Josh runs it next year');
select t.ok(public.my_rank('rkt') = 1, 'the outgoing owner is now a member (no officer powers)');
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(public.my_rank('rkt') = 5, 'the successor is the owner');
reset role;
select t.ok((select owner_id = current_setting('t.josh')::uuid from public.communities where id = 'rkt'), 'the club records its new owner');
select t.ok((select count(*) = 1 from public.club_handoffs where community_id = 'rkt' and role = 'owner' and from_uid = current_setting('t.ben')::uuid and to_uid = current_setting('t.josh')::uuid), 'the handoff is recorded');
select t.ok((select posts = (select count(*) from public.posts where community_id = 'rkt') and members = (select count(*) from public.community_members where community_id = 'rkt') from before), 'the club, its posts and members carry over');
-- Members can see their club's handoff history; outsiders can't.
select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) = 0 from public.club_handoffs where community_id = 'rkt'), 'outsiders don''t see the handoff history');
reset role;
rollback;
\echo 'handoff tests: all passed'
