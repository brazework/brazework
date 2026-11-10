-- Tests for supabase/club-claims.sql, acting as real members. Runs in one transaction and rolls back.
-- Needs the e2e seed: Ben owns Rocketry Club (rkt), Josh is a member, Maya is a Forge admin, Cara
-- is in no club there; forge.test counts as a school domain.
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

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

-- Josh (a member) and Cara (not a member) both ask to claim Rocketry Club.
select t.as_('josh'); set local role authenticated;
select set_config('t.claim', public.request_club_claim('rkt', 'President, Rocketry Club', 'The club page on the university site lists me as president: https://example.edu/clubs/rocketry')::text, false);
select t.must_fail($$select public.request_club_claim('rkt', 'President', 'Asking a second time for the same club')$$, 'already asked');
select t.must_fail($$select public.request_club_claim('rob', 'P', 'Too short a role title')$$, 'check constraint');
select t.must_fail($$select public.decide_club_claim(current_setting('t.claim')::bigint, true)$$, 'Forge admins only');
select t.ok((select count(*) = 1 from public.club_claims where claimant = current_setting('t.josh')::uuid), 'you can see your own claim');
reset role;

select t.as_('cara'); set local role authenticated;
select set_config('t.cara_claim', public.request_club_claim('rkt', 'Treasurer', 'I run the budget spreadsheet for the club this year.')::text, false);
select t.ok((select count(*) = 1 from public.club_claims), 'members only see their own claims');
reset role;

-- The current owner can't see claims against the club, and can't claim what he owns.
select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) = 0 from public.club_claims), 'the current owner doesn''t see the claims');
select t.must_fail($$select public.request_club_claim('rkt', 'Owner', 'I already own this one, so this should fail')$$, 'already own');
reset role;

-- Claims need a school email.
update auth.users set email = 'ben@gmail.com' where id = current_setting('t.ben')::uuid;
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.request_club_claim('rob', 'Captain', 'Trying to claim with a personal email address')$$, 'school email');
reset role;

-- Maya (a Forge admin) sees both and approves Josh's.
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 2 from public.club_claims where community_id = 'rkt'), 'Forge admins see every claim');
select public.decide_club_claim(current_setting('t.claim')::bigint, true, 'Checked the university club page.');
select t.must_fail($$select public.decide_club_claim(current_setting('t.claim')::bigint, false)$$, 'isn''t open');
reset role;

select t.ok((select role = 'owner' from public.community_members where community_id = 'rkt' and uid = current_setting('t.josh')::uuid), 'the claimant is now the owner');
select t.ok((select role = 'member' from public.community_members where community_id = 'rkt' and uid = current_setting('t.ben')::uuid), 'the previous owner stays as a member');
select t.ok((select owner_id = current_setting('t.josh')::uuid from public.communities where id = 'rkt'), 'the club records its new owner');
select t.ok((select count(*) = 1 from public.club_handoffs where community_id = 'rkt' and to_uid = current_setting('t.josh')::uuid and from_uid = current_setting('t.ben')::uuid), 'the handoff is logged');
select t.ok((select status = 'denied' from public.club_claims where id = current_setting('t.cara_claim')::bigint), 'other open claims on the club close');
select t.ok((select count(*) >= 1 from public.notifications where user_id = current_setting('t.josh')::uuid and snippet like 'You''re now the owner%'), 'the new owner is notified');
select t.ok((select count(*) >= 1 from public.notifications where user_id = current_setting('t.ben')::uuid and snippet like '%verified claim%'), 'the previous owner is notified');

-- Withdrawing: only your own open claim.
select t.as_('cara'); set local role authenticated;
select set_config('t.cara2', public.request_club_claim('rob', 'Captain', 'Robotics Society captain, listed on the team roster.')::text, false);
select public.withdraw_club_claim(current_setting('t.cara2')::bigint);
select t.ok((select status = 'withdrawn' from public.club_claims where id = current_setting('t.cara2')::bigint), 'you can withdraw your claim');
select t.must_fail($$select public.withdraw_club_claim(current_setting('t.cara2')::bigint)$$, 'isn''t open');
reset role;

rollback;
\echo 'club-claims tests: all passed'
