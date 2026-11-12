-- Tests for supabase/vouches.sql: a member without a club can log a milestone and ask someone who saw
-- it to vouch, only at a university or verified-company address (never free mail, never themselves),
-- only for their own milestone. The member never sees the link's hash. Whoever holds the link can
-- preview it and vouch once (with real answers), which verifies the milestone with their name on it;
-- the link can't be reused, and expired links refuse. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben logs a milestone on his own project with no club.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence)
values ('p1', null, 'Thrust stand reads within 2%', 'Calibrated against reference weights', 'https://github.com/acme/rig/pull/9');
reset role;
select id as ms from public.milestones where title = 'Thrust stand reads within 2%' \gset
select set_config('t.ms', :'ms', false);
select t.ok((select status = 'pending' and community_id is null from public.milestones where id = :'ms'), 'a milestone can stand without a club, waiting for proof');

-- Asking: only good addresses, only your own milestone, never yourself.
select t.as_('ben'); set local role authenticated;
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'prof.lee@gmail.com', 'professor', repeat('1', 64))$$, 'P0001', 'free mail can''t vouch');
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'not an email', 'professor', repeat('1', 64))$$, 'P0001', 'it has to be an email address');
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'prof.lee@utexas.edu', 'friend', repeat('1', 64))$$, 'P0001', 'the relationship must be one we know');
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'prof.lee@utexas.edu', 'professor', 'short')$$, 'P0001', 'the link hash must look like a sha256');
select public.request_vouch(:'ms', 'Prof.Lee@UTexas.edu', 'professor', repeat('a', 64)) is not null as asked \gset
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'prof.lee@utexas.edu', 'professor', repeat('b', 64))$$, 'P0001', 'the same person can''t be asked twice at once');
-- Ben can see his ask, but not the link's hash.
select t.ok((select count(*) = 1 and bool_and(email = 'prof.lee@utexas.edu' and state = 'asked') from public.milestone_vouches where milestone_id = current_setting('t.ms')), 'the member sees the ask, address lower-cased');
select t.refused($$select token_hash from public.milestone_vouches$$, '42501', 'the member can''t read the link hash');
reset role;

select t.as_('maya'); set local role authenticated;
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'dean@utexas.edu', 'mentor', repeat('c', 64))$$, '42501', 'nobody can ask about someone else''s milestone');
select t.ok((select count(*) = 0 from public.milestone_vouches), 'other members can''t see the asks');
reset role;

-- Ben can't ask himself (his own address, whatever the domain rules say).
select t.as_('ben'); set local role authenticated;
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'ben@forge.test', 'mentor', repeat('d', 64))$$, 'P0001', 'you can''t vouch for yourself');
reset role;

-- Holding the link (anon): preview it, then answer once.
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.ok((select public.vouch_preview(repeat('a', 64))->>'title' = 'Thrust stand reads within 2%'), 'the link shows what it''s about');
select t.ok(public.vouch_preview(repeat('9', 64)) is null, 'an unknown link shows nothing');
select t.refused($$select token_hash from public.milestone_vouches$$, '42501', 'nobody reads the table directly');
select t.refused($$select public.answer_vouch(repeat('a', 64), true, 'Dr. Priya Lee', 'Assistant Professor', 'ok', 'Her lab')$$, 'P0001', 'a vouch needs a real answer about what they saw');
select t.refused($$select public.answer_vouch(repeat('a', 64), true, '', 'Assistant Professor', 'I watched the calibration run in the propulsion lab on Nov 3.', 'His advisor')$$, 'P0001', 'a vouch needs a name');
select public.answer_vouch(repeat('a', 64), true, 'Dr. Priya Lee', 'Assistant Professor', 'I watched the calibration run in the propulsion lab on Nov 3; the readings matched the reference weights.', 'I''m his research advisor') as answer \gset
select t.ok(:'answer' = 'vouched', 'vouching works from the link alone');
select t.refused($$select public.answer_vouch(repeat('a', 64), true, 'Dr. Priya Lee', '', 'I watched the calibration run in the propulsion lab on Nov 3.', 'His advisor')$$, 'P0001', 'a link works once');
reset role;

select t.ok((select status = 'verified' and vouched_by = 'Dr. Priya Lee, Assistant Professor · utexas.edu' and reviewer_role = 'professor' from public.milestones where id = :'ms'), 'the milestone is verified, with the voucher named on it');
select t.ok((select count(*) = 2 from public.verification_events where milestone_id = :'ms' and action in ('vouch_requested', 'vouched')), 'the ask and the vouch are in the log');
select t.ok(exists (select 1 from public.notifications where user_id = :'ben'::uuid and kind = 'milestone_verified' and actor_first = 'Dr. Priya Lee'), 'the member is told who vouched');

-- A verified milestone takes no more asks.
select t.as_('ben'); set local role authenticated;
select t.refused($$select public.request_vouch(current_setting('t.ms'), 'other@utexas.edu', 'ta', repeat('e', 64))$$, 'P0001', 'a verified milestone takes no more asks');

-- Expired links refuse.
insert into public.milestones (project_id, community_id, title, evidence) values ('p1', null, 'Second test burn', 'https://github.com/acme/rig/pull/10');
reset role;
select id as ms2 from public.milestones where title = 'Second test burn' \gset
select set_config('t.ms2', :'ms2', false);
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'ms2', 'ta.kim@utexas.edu', 'ta', repeat('f', 64)) is not null as asked2 \gset
reset role;
update public.milestone_vouches set expires_at = now() - interval '1 minute' where token_hash = repeat('f', 64);
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.ok((select public.vouch_preview(repeat('f', 64))->>'state' = 'expired'), 'an old link says it has expired');
select t.refused($$select public.answer_vouch(repeat('f', 64), true, 'Sam Kim', 'TA', 'I graded the burn report and saw the data from the test stand.', 'TA for his lab section')$$, 'P0001', 'an expired link can''t vouch');
reset role;

-- Declining: the link closes, the milestone stays waiting.
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'ms2', 'pi.ortiz@utexas.edu', 'pi', repeat('0', 64)) is not null as asked3 \gset
reset role;
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.answer_vouch(repeat('0', 64), false, '', '', '', '') as declined \gset
reset role;
select t.ok(:'declined' = 'declined' and (select status = 'pending' from public.milestones where id = :'ms2'), 'declining closes the link and leaves the milestone waiting');

rollback;
\echo 'vouch tests: all passed'
