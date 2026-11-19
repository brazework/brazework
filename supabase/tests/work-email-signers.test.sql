-- Tests for supabase/work-email-signers.sql: any work address can sign, and the signature says which
-- kind it is. A university or a verified company reads as before; a work address at a company that
-- isn't verified here is labelled "(company not verified)". Free mail and throwaway inboxes still
-- can't sign, and every other guard holds. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.ben', :'ben', false);

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

-- A company verified on Brazework, for the comparison.
insert into public.organizations (name, type, domain, verification_status)
select 'Verified Test Co', 'company', 'verified-test-co.example', 'verified'
where not exists (select 1 from public.organizations where lower(domain) = 'verified-test-co.example');

-- Which kind each address is.
select t.ok(public.vouch_email_kind('Prof.Lee@UTexas.edu') = 'school', 'a university address is a school');
select t.ok(public.vouch_email_kind('sam@verified-test-co.example') = 'company', 'a verified company''s address is a company');
select t.ok(public.vouch_email_kind('sam@northwind-payments.io') = 'work', 'any other work address is work');
select t.ok(public.vouch_email_kind('sam@gmail.com') = '' and public.vouch_email_kind('sam@outlook.fr') = '' and public.vouch_email_kind('sam@yahoo.co.uk') = ''
  and public.vouch_email_kind('sam@mail.proton.me') = '' and public.vouch_email_kind('sam@icloud.com') = '', 'free mail is never a signer''s address, under any country ending');
select t.ok(public.vouch_email_kind('x@mailinator.com') = '' and public.vouch_email_kind('x@yopmail.com') = '', 'nor a throwaway inbox');
select t.ok(public.vouch_email_kind('not an email') = '' and public.vouch_email_kind('a@b') = '' and public.vouch_email_kind('a@b..com') = '' and public.vouch_email_kind(null) = '', 'nor something that isn''t an address');
select t.ok(public.vouch_email_ok('sam@northwind-payments.io') and not public.vouch_email_ok('sam@gmail.com'), 'the ask''s check follows the kind');
-- A company whose own name starts like a mail provider's is still a company.
select t.ok(public.vouch_email_kind('dana@livewire-robotics.com') = 'work' and public.vouch_email_kind('dana@outlookgroup.com') = 'work', 'a company isn''t mistaken for free mail by its name');

-- Ben, who works, logs two milestones with no club and asks his tech lead and a verified company.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence)
values ('p1', null, 'Checkout p95 down to 310 ms', 'Before and after on the dashboard', 'https://github.com/acme/checkout/pull/1187'),
       ('p1', null, 'Fraud model precision up 6 points', 'Held-out month', 'https://github.com/acme/fraud/pull/88');
reset role;
select id as m1 from public.milestones where title = 'Checkout p95 down to 310 ms' \gset
select id as m2 from public.milestones where title = 'Fraud model precision up 6 points' \gset
select set_config('t.m1', :'m1', false), set_config('t.m2', :'m2', false);

select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'m1', 'sam.rivera@northwind-payments.io', 'manager', repeat('a', 64));
select public.request_vouch(:'m2', 'lee@verified-test-co.example', 'mentor', repeat('b', 64));
select t.refused($$select public.request_vouch(current_setting('t.m1'), 'sam.rivera@gmail.com', 'manager', repeat('c', 64))$$, 'P0001', 'free mail still can''t be asked');
select t.refused($$select public.request_vouch(current_setting('t.m1'), 'ben@forge.test', 'manager', repeat('d', 64))$$, 'P0001', 'nor the member''s own address');
reset role;
select t.ok((select count(*) = 1 from public.milestone_vouches where milestone_id = :'m1' and state = 'asked'), 'a tech lead at a company that isn''t verified here can be asked');

-- They sign from the link.
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.answer_vouch(repeat('a', 64), true, 'Sam Rivera', 'Staff Engineer', 'I reviewed the PRs and watched p95 drop on the dashboard after the deploy.', 'I''m his tech lead') as a1 \gset
select public.answer_vouch(repeat('b', 64), true, 'Lee Park', 'Principal Engineer', 'I reviewed the evaluation notebook and reran the held-out month.', 'I mentor him') as a2 \gset
reset role;
select t.ok(:'a1' = 'vouched' and :'a2' = 'vouched', 'both sign');
select t.ok((select status = 'verified' and vouched_by = 'Sam Rivera, Staff Engineer · northwind-payments.io (company not verified)' from public.milestones where id = :'m1'),
  'a work address at an unverified company says so in the signature');
select t.ok((select vouched_by = 'Lee Park, Principal Engineer · verified-test-co.example' from public.milestones where id = :'m2'), 'a verified company''s signature reads as before');
select t.ok(exists (select 1 from public.verification_events where milestone_id = :'m1' and action = 'vouched' and note like '%(company not verified)'), 'and the log keeps the same words');

-- A very long name and role still fit: the domain and the label are never cut.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence) values ('p1', null, 'Long label check', 'x', 'https://github.com/acme/x/pull/1');
reset role;
select id as m3 from public.milestones where title = 'Long label check' \gset
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'m3', 'cto@a-very-long-company-name-for-the-test.engineering', 'manager', repeat('e', 64));
reset role;
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.answer_vouch(repeat('e', 64), true, repeat('N', 80), repeat('T', 80), 'I watched the whole thing happen from start to finish.', 'His manager');
reset role;
select t.ok((select char_length(vouched_by) <= 160 and vouched_by like '% · a-very-long-company-name-for-the-test.engineering (company not verified)' from public.milestones where id = :'m3'),
  'a long name is shortened; the domain and its label are kept');

-- Confidential work: the public line never calls an unverified company verified.
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.maya', :'maya', false);
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence, private) values
  ('p1', null, 'Northwind ledger cutover', 'Confidential', 'https://example.com/internal-a', true),
  ('p1', null, 'Verified Co pricing engine', 'Confidential', 'https://example.com/internal-b', true);
reset role;
select id as p1 from public.milestones where title = 'Northwind ledger cutover' \gset
select id as p2 from public.milestones where title = 'Verified Co pricing engine' \gset
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'p1', 'dana@northwind-payments.io', 'manager', repeat('5', 64));
select public.request_vouch(:'p2', 'kim@verified-test-co.example', 'manager', repeat('6', 64));
reset role;
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.answer_vouch(repeat('5', 64), true, 'Dana Ruiz', 'Director', 'I ran the cutover with him and watched the ledgers reconcile.', 'His manager');
select public.answer_vouch(repeat('6', 64), true, 'Kim Lee', 'Director', 'I reviewed the pricing engine rollout and the results.', 'His manager');
reset role;
select t.as_('ben'); set local role authenticated;
select public.set_public_line(:'p1', 'Led a ledger cutover');
select public.set_public_line(:'p2', 'Rebuilt a pricing engine');
reset role;
select t.as_('maya'); set local role authenticated;
select public.redacted_proof(:'ben'::uuid) as r \gset
reset role;
select t.ok((select x->'signer'->>'org' = 'work' from jsonb_array_elements(:'r'::jsonb) x where x->>'line' = 'Led a ledger cutover'), 'a private line signed from an unverified company says work, not company');
select t.ok((select x->'signer'->>'org' = 'company' from jsonb_array_elements(:'r'::jsonb) x where x->>'line' = 'Rebuilt a pricing engine'), 'and a verified company''s still says company');
select t.ok(:'r' not like '%northwind%' and :'r' not like '%Dana%', 'the line still never names the signer or the domain');

-- The list and the helpers aren't open to members or visitors.
select t.as_('ben'); set local role authenticated;
select t.refused($$select * from public.free_mail_domains$$, '42501', 'members can''t read the list');
select t.refused($$select public.free_mail('gmail.com')$$, '42501', 'or call the helper');
reset role;
set local role anon;
select t.refused($$select public.vouch_email_kind('a@b.com')$$, '42501', 'signed-out callers can''t probe addresses');
reset role;

\echo 'work-email-signers: all passed'
rollback;
