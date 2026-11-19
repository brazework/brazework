-- Tests for supabase/signer-tools.sql: one reminder 3 days after an ask, never twice, with a second link
-- that opens the same single-use ask; a signer holding one live link sees and answers the other asks
-- sent to the same address, each under every vouches.sql rule, and nobody else's; and a signer sees
-- what they've signed (vouches from their confirmed email, club verifications, Pro sign-offs), with a
-- milestone made private showing only their own words. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

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
grant usage on schema t to authenticated, anon, service_role;
grant execute on all functions in schema t to authenticated, anon, service_role;

-- Ben logs four clubless milestones and asks: three to Prof. Lee, one to someone else.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence) values
  ('p1', null, 'Signer: thrust stand within 2%', 'Calibrated', 'https://github.com/acme/rig/pull/1'),
  ('p1', null, 'Signer: injector flow test', 'Water flow', 'https://github.com/acme/rig/pull/2'),
  ('p1', null, 'Signer: igniter timing', 'Scope capture', 'https://github.com/acme/rig/pull/3'),
  ('p1', null, 'Signer: feed system leak check', 'Held 300 psi', 'https://github.com/acme/rig/pull/4');
reset role;
select id as s1 from public.milestones where title = 'Signer: thrust stand within 2%' \gset
select id as s2 from public.milestones where title = 'Signer: injector flow test' \gset
select id as s3 from public.milestones where title = 'Signer: igniter timing' \gset
select id as s4 from public.milestones where title = 'Signer: feed system leak check' \gset
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'s1', 'prof.lee@utexas.edu', 'professor', repeat('1', 64)) as a1 \gset
select public.request_vouch(:'s2', 'prof.lee@utexas.edu', 'professor', repeat('2', 64)) as a2 \gset
select public.request_vouch(:'s3', 'prof.lee@utexas.edu', 'pi', repeat('3', 64)) as a3 \gset
select public.request_vouch(:'s4', 'dean.ortiz@utexas.edu', 'mentor', repeat('4', 64)) as a4 \gset
reset role;

-- ---------- 1. One reminder, 3 days on ----------
set local role service_role;
select t.ok(not exists (select 1 from public.vouch_reminders_due()), 'nothing is due the day it''s asked');
reset role;
update public.milestone_vouches set created_at = now() - interval '3 days 1 hour' where id in (:a1, :a2, :a4);
set local role service_role;
select t.ok((select count(*) = 3 from public.vouch_reminders_due()), 'asks 3 days old are due');
select t.ok((select member = 'Ben Cho' and title = 'Signer: thrust stand within 2%' and email = 'prof.lee@utexas.edu' from public.vouch_reminders_due() where id = :a1), 'with what the email needs');
select t.ok(public.claim_vouch_reminder(:a1, repeat('a', 64)), 'a run claims the reminder with its new link''s hash');
select t.ok(not public.claim_vouch_reminder(:a1, repeat('b', 64)), 'never a second reminder');
select t.ok(not exists (select 1 from public.vouch_reminders_due() where id = :a1), 'and it''s no longer due');
select public.claim_vouch_reminder(:a4, repeat('c', 64));
select public.release_vouch_reminder(:a4, repeat('c', 64));
select t.ok(exists (select 1 from public.vouch_reminders_due() where id = :a4), 'a failed send hands it back');
reset role;
select t.as_('ben'); set local role authenticated;
select t.refused($$select * from public.vouch_reminders_due()$$, '42501', 'members can''t list reminders');
select t.refused($$select public.claim_vouch_reminder(1, repeat('d', 64))$$, '42501', 'or claim one');
select t.refused($$select reminder_hash from public.milestone_vouches$$, '42501', 'or read the reminder link''s hash');
reset role;

-- Either link opens the same ask.
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.ok((public.vouch_preview(repeat('a', 64))->>'title') = 'Signer: thrust stand within 2%', 'the reminder''s link opens the ask');
select t.ok((public.vouch_preview(repeat('1', 64))->>'title') = 'Signer: thrust stand within 2%', 'and the first link still does');

-- ---------- 2. Several at once ----------
select public.vouch_inbox(repeat('a', 64)) as inbox \gset
select t.ok(jsonb_array_length(:'inbox'::jsonb) = 2 and (select bool_and(x->>'title' in ('Signer: injector flow test', 'Signer: igniter timing')) from jsonb_array_elements(:'inbox'::jsonb) x),
  'one live link shows the other asks sent to the same address, not the dean''s');
select t.ok(public.vouch_inbox(repeat('9', 64)) = '[]'::jsonb, 'an unknown link shows nothing');

select public.answer_vouches(repeat('a', 64), 'Dr. Priya Lee', 'Assistant Professor', jsonb_build_array(
  jsonb_build_object('id', :a1, 'saw', 'I watched the calibration run in the lab on Nov 3.', 'knows_from', 'I''m his advisor'),
  jsonb_build_object('id', :a2, 'saw', 'too short', 'knows_from', 'I''m his advisor'),
  jsonb_build_object('id', :a3, 'saw', 'I saw the igniter scope capture in our lab review.', 'knows_from', 'Lab PI'),
  jsonb_build_object('id', :a4, 'saw', 'I watched the leak check from the control room.', 'knows_from', 'Mentor'))) as batch \gset
select t.ok((select (x->>'ok')::boolean and x->>'result' = 'vouched' from jsonb_array_elements(:'batch'::jsonb) x where (x->>'id')::bigint = :a1), 'the first one is vouched');
select t.ok((select not (x->>'ok')::boolean and x->>'message' like 'Say what you saw%' from jsonb_array_elements(:'batch'::jsonb) x where (x->>'id')::bigint = :a2),
  'each needs its own real answer: a short one is refused');
select t.ok((select (x->>'ok')::boolean from jsonb_array_elements(:'batch'::jsonb) x where (x->>'id')::bigint = :a3), 'and a refused one doesn''t stop the rest');
select t.ok((select not (x->>'ok')::boolean and x->>'message' = 'That ask wasn''t sent to you.' from jsonb_array_elements(:'batch'::jsonb) x where (x->>'id')::bigint = :a4),
  'an ask to another address can''t be answered with this link');
reset role;
select t.ok((select status = 'verified' and vouched_by = 'Dr. Priya Lee, Assistant Professor · utexas.edu' from public.milestones where id = :'s1'), 's1 is signed, with her name on it');
select t.ok((select status = 'verified' and reviewer_role = 'pi' from public.milestones where id = :'s3'), 's3 too, in the role Ben asked her as');
select t.ok((select status = 'pending' from public.milestones where id = :'s2') and (select state = 'asked' from public.milestone_vouches where id = :a2), 's2 is still waiting');
select t.ok((select status = 'pending' from public.milestones where id = :'s4') and (select state = 'asked' from public.milestone_vouches where id = :a4), 'the dean''s ask is untouched');
select t.ok((select count(*) = 2 from public.verification_events where milestone_id in (:'s1', :'s3') and action = 'vouched'), 'each vouch is in the log');

-- The used link still works for the rest, for a day; then it doesn't.
set local role anon;
select t.ok(jsonb_array_length(public.vouch_inbox(repeat('1', 64))) = 1, 'the answered link still shows what''s left, for a day');
select t.refused($$select public.answer_vouch(repeat('a', 64), true, 'Dr. Priya Lee', '', 'I watched the calibration run in the lab on Nov 3.', 'Advisor')$$, 'P0001', 'but each ask is still answered once');
reset role;
update public.milestone_vouches set answered_at = now() - interval '2 days' where id = :a1;
set local role anon;
select t.ok(public.vouch_inbox(repeat('1', 64)) = '[]'::jsonb, 'after a day, the used link shows nothing');
select t.refused(format($$select public.answer_vouches(repeat('1', 64), 'Dr. Priya Lee', '', '[{"id": %s, "saw": "I watched the injector flow test on the bench.", "knows_from": "Advisor"}]')$$, :a2),
  'P0001', 'and answers nothing');
reset role;

-- The 8-a-month limit per address holds in a batch.
insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash, state, answered_at)
select :'s2', :'ben', 'prof.lee@utexas.edu', 'professor', lpad(to_hex(g), 64, 'e'), 'vouched', now() from generate_series(1, 6) g;
set local role anon;
select (public.answer_vouches(repeat('2', 64), 'Dr. Priya Lee', '', jsonb_build_array(jsonb_build_object('id', :a2, 'saw', 'I watched the injector flow test on the bench.', 'knows_from', 'Advisor')))->0) as lim \gset
select t.ok(not (:'lim'::jsonb->>'ok')::boolean and (:'lim'::jsonb->>'message') like '%8 times this month%', 'an address that vouched 8 times this month is stopped, in a batch too');
reset role;

-- ---------- 3. What you've signed ----------
-- Cara has an account at Prof. Lee's address (as if she'd signed up with it); Maya verified m1 for the club.
delete from public.milestone_vouches where token_hash like 'eeee%';
update auth.users set email = 'prof.lee@utexas.edu', email_confirmed_at = now() where id = :'cara';
update public.milestones set reviewer_id = :'maya' where id = 'm1';
update public.milestones set private = false where id = :'s1';
update public.milestones set private = true where id = :'s3';
select t.as_('cara'); set local role authenticated;
select public.my_signatures() as mine \gset
select t.ok(jsonb_array_length(:'mine'::jsonb) = 2 and (select bool_and(x->>'kind' = 'vouch') from jsonb_array_elements(:'mine'::jsonb) x), 'a signer sees the vouches sent from their confirmed address');
select t.ok((select x->>'wrote' = 'I watched the calibration run in the lab on Nov 3.' and x->>'title' = 'Signer: thrust stand within 2%' and x->'member'->>'first' = 'Ben'
  from jsonb_array_elements(:'mine'::jsonb) x where x->>'milestone' = :'s1'), 'with what they wrote, for whom, about what');
select t.ok((select x->>'title' = '' and (x->>'private')::boolean and x->>'wrote' like 'I saw the igniter%' from jsonb_array_elements(:'mine'::jsonb) x where x->>'milestone' = :'s3'),
  'a milestone made private shows only the signer''s own words');
reset role;
update auth.users set email_confirmed_at = null where id = :'cara';
select t.as_('cara'); set local role authenticated;
select t.ok(public.my_signatures() = '[]'::jsonb, 'only from a confirmed address');
reset role;
select t.as_('maya'); set local role authenticated;
select t.ok((select bool_or(x->>'kind' = 'club' and x->>'milestone' = 'm1' and x->>'club' = 'Rocketry Club') from jsonb_array_elements(public.my_signatures()) x), 'an officer sees what they verified for the club');
reset role;
select t.as_('ben'); set local role authenticated;
select t.ok(public.my_signatures() = '[]'::jsonb, 'a member who signed nothing sees nothing (not their own milestones)');
reset role;
set local role anon;
select t.refused($$select public.my_signatures()$$, '42501', 'signed out, nothing');
reset role;

select 'signer-tools: all passed' as passed;
rollback;
