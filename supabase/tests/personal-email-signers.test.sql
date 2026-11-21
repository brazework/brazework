-- Tests for supabase/personal-email-signers.sql (step 86): a personal address (Gmail, Outlook and the
-- like) can sign "someone who saw it", and the signature says "(personal email)" everywhere it shows.
-- Throwaway inboxes still can't, with words that say why, and every other guard holds. Runs in one
-- transaction; rolls back. Needs the e2e seed (Ben, his project p1, Maya).
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
create function t.refused_with(call text, words text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if position(lower(words) in lower(sqlerrm)) > 0 then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %)', what, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Which kind each address is now.
select t.ok(public.vouch_email_kind('sam@gmail.com') = 'personal' and public.vouch_email_kind('Sam@Outlook.com') = 'personal'
  and public.vouch_email_kind('sam@yahoo.co.uk') = 'personal' and public.vouch_email_kind('sam@icloud.com') = 'personal', 'free mail is personal');
select t.ok(public.vouch_email_kind('x@mailinator.com') = '' and public.vouch_email_kind('x@sub.yopmail.com') = '' and public.vouch_email_kind('x@10minutemail.com') = '', 'a throwaway inbox still can''t sign');
select t.ok(public.vouch_email_kind('prof.lee@utexas.edu') = 'school' and public.vouch_email_kind('sam@northwind-payments.io') = 'work', 'school and work are unchanged');
select t.ok(public.vouch_email_ok('sam@gmail.com') and not public.vouch_email_ok('x@mailinator.com'), 'the ask''s check follows the kind');

-- Ben asks a mentor at their personal address; a throwaway inbox is refused with words that say why.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence)
values ('p1', null, 'Welded the rover chassis', 'Photos of every joint', 'https://example.com/chassis-photos');
reset role;
select id as m1 from public.milestones where title = 'Welded the rover chassis' \gset
select set_config('t.m1', :'m1', false);
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'m1', 'Jordan.Mentor@Gmail.com', 'mentor', repeat('7', 64));
select t.refused_with($$select public.request_vouch(current_setting('t.m1'), 'x@mailinator.com', 'mentor', repeat('8', 64))$$, 'throwaway inbox', 'a throwaway inbox is refused, and the words say so');
select t.refused_with($$select public.request_vouch(current_setting('t.m1'), 'ben@forge.test', 'mentor', repeat('9', 64))$$, 'isn''t on the project', 'still never the member''s own address');
reset role;
select t.ok((select count(*) = 1 from public.milestone_vouches where milestone_id = :'m1' and state = 'asked' and email = 'jordan.mentor@gmail.com'), 'a personal address can be asked');

-- They sign; the signature says it came from a personal email, on the record and in the log.
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.answer_vouch(repeat('7', 64), true, 'Jordan Ellis', 'Welding instructor', 'I watched him weld every joint of the chassis and checked the penetration.', 'I taught him to weld') as a1 \gset
reset role;
select t.ok(:'a1' = 'vouched', 'they sign');
select t.ok((select status = 'verified' and vouched_by = 'Jordan Ellis, Welding instructor · gmail.com (personal email)' from public.milestones where id = :'m1'),
  'the signature says it came from a personal email');
select t.ok(exists (select 1 from public.verification_events where milestone_id = :'m1' and action = 'vouched' and note like '%(personal email)'), 'and the log keeps the same words');

-- A private milestone's public line calls it personal, never a company's.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence, private)
values ('p1', null, 'Side gig retrofit', 'Confidential', 'https://example.com/retrofit', true);
reset role;
select id as p1m from public.milestones where title = 'Side gig retrofit' \gset
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'p1m', 'pat.client@outlook.com', 'other', repeat('3', 64));
reset role;
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.answer_vouch(repeat('3', 64), true, 'Pat Client', '', 'I hired him for the retrofit and saw it run for a month.', 'I was the client');
reset role;
select t.as_('ben'); set local role authenticated;
select public.set_public_line(:'p1m', 'Retrofitted a CNC controller');
reset role;
select t.as_('maya'); set local role authenticated;
select public.redacted_proof(:'ben'::uuid) as r \gset
reset role;
select t.ok((select x->'signer'->>'org' = 'personal' from jsonb_array_elements(:'r'::jsonb) x where x->>'line' = 'Retrofitted a CNC controller'), 'a private line signed from a personal address says personal');
select t.ok(:'r' not like '%outlook%' and :'r' not like '%Pat%', 'and still never names the signer or the domain');

-- The new list and helper aren't open to members or visitors.
select t.as_('ben'); set local role authenticated;
select t.refused_with($$select * from public.throwaway_mail_domains$$, 'permission denied', 'members can''t read the throwaway list');
select t.refused_with($$select public.throwaway_mail('mailinator.com')$$, 'permission denied', 'or call its helper');
reset role;

select t.ok(public.personal_email_signers_ready(), 'the app can tell the step has run');

\echo 'personal-email-signers: all passed'
rollback;
