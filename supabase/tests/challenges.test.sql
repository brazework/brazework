-- Tests for supabase/challenges.sql, acting as real members through row-level security. Runs in one
-- transaction and rolls back. Needs the e2e seed (Cara admins the verified company "Acme Aerospace";
-- Ben owns projects p1 and p2; Josh owns none).
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false), set_config('t.maya', :'maya', false);
select set_config('t.org', (select id from public.organizations where domain = 'forge.test'), false);

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

-- Only a verified organization's admins create challenges, and only as drafts.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$insert into public.challenges (org_id, title, brief, deadline) values (current_setting('t.org'), 'Not mine', 'Josh is not an admin of this company.', now() + interval '14 days')$$, 'row-level security');
reset role; select t.as_('cara'); set local role authenticated;
select t.must_fail($$insert into public.challenges (org_id, title, brief, deadline, status) values (current_setting('t.org'), 'Skip ahead', 'Trying to publish without paying.', now() + interval '14 days', 'open')$$, 'permission denied');
insert into public.challenges (org_id, title, brief, prize, deadline)
values (current_setting('t.org'), 'Lightest flight computer', 'Build a flight computer under 20 g that logs at 100 Hz or more.', '$1,000 + interviews', now() + interval '14 days');
select set_config('t.ch', (select id from public.challenges where title = 'Lightest flight computer'), false);
select t.ok((select status = 'draft' and sponsorship = 'unpaid' and created_by = current_setting('t.cara')::uuid from public.challenges where id = current_setting('t.ch')), 'a new challenge is an unpaid draft, recorded as Cara''s');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) = 0 from public.challenges where id = current_setting('t.ch')), 'members can''t see drafts');

-- It doesn't go live until it's paid for (or a Forge admin approves a pilot).
reset role; select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.publish_challenge(current_setting('t.ch'))$$, 'Sponsor the challenge first');
select t.must_fail($$update public.challenges set sponsorship = 'paid' where id = current_setting('t.ch')$$, 'permission denied');
select t.ok(public.request_sponsorship(current_setting('t.ch')) = 'requested', 'Cara requests a sponsorship');
select t.ok((select count(*) = 1 and bool_and(status = 'requested' and plan = 'challenge') from public.billing_requests where challenge_id = current_setting('t.ch')), 'the request is recorded for billing');
select t.must_fail($$select public.set_sponsorship(current_setting('t.ch'), 'pilot')$$, 'Forge admins only');
reset role;
insert into public.forge_admins (uid) values (current_setting('t.maya')::uuid) on conflict do nothing;
select t.as_('maya'); set local role authenticated;
select t.ok(public.set_sponsorship(current_setting('t.ch'), 'pilot') = 'pilot', 'a Forge admin approves it as a pilot');
reset role; select t.as_('cara'); set local role authenticated;
select t.ok(public.publish_challenge(current_setting('t.ch')) = 'open', 'then it goes live');

-- Members enter with their own projects only, once each.
reset role; select t.as_('josh'); set local role authenticated;
select t.must_fail($$insert into public.challenge_entries (challenge_id, project_id) values (current_setting('t.ch'), 'p1')$$, 'row-level security');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) = 1 from public.challenges where id = current_setting('t.ch')), 'members see it once it''s live');
insert into public.challenge_entries (challenge_id, project_id, note) values (current_setting('t.ch'), 'p2', 'Dual-deploy, 14 g');
select t.must_fail($$insert into public.challenge_entries (challenge_id, project_id) values (current_setting('t.ch'), 'p2')$$, 'duplicate key');
select t.must_fail($$update public.challenge_entries set placement = 1 where challenge_id = current_setting('t.ch')$$, 'permission denied');
select t.ok((select uid = current_setting('t.ben')::uuid and placement is null from public.challenge_entries where challenge_id = current_setting('t.ch')), 'the entry is Ben''s, unplaced');
reset role; select t.as_('josh'); set local role authenticated;
select t.ok((select count(*) = 0 from public.challenge_entries where challenge_id = current_setting('t.ch')), 'other members can''t see entries while it runs');
select t.ok((select entries = 1 from public.challenge_entry_counts(array[current_setting('t.ch')])), 'but everyone sees how many entered');

-- The sponsor judges: close entries, place winners, announce.
reset role; select t.as_('cara'); set local role authenticated;
select set_config('t.entry', (select id::text from public.challenge_entries where challenge_id = current_setting('t.ch')), false);
select t.must_fail($$select public.place_entry(current_setting('t.entry')::bigint, 1)$$, 'Close entries before picking winners');
select t.ok(public.close_challenge(current_setting('t.ch')) = 'judging', 'entries close for judging');
reset role; select t.as_('ben'); set local role authenticated;
select t.must_fail($$insert into public.challenge_entries (challenge_id, project_id) values (current_setting('t.ch'), 'p1')$$, 'row-level security');
select t.must_fail($$select public.place_entry(current_setting('t.entry')::bigint, 1)$$, 'Only the sponsor''s admins');
reset role; select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.close_challenge(current_setting('t.ch'))$$, 'Pick at least one winner first');
select public.place_entry(current_setting('t.entry')::bigint, 1);
select t.ok(public.close_challenge(current_setting('t.ch')) = 'closed', 'winners announced');
reset role; select t.as_('josh'); set local role authenticated;
select t.ok((select count(*) = 1 and bool_and(placement = 1) from public.challenge_entries where challenge_id = current_setting('t.ch')), 'everyone sees the winners once it closes');

-- Admin metrics are Forge admins' only.
reset role; select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.admin_metrics()$$, 'Forge admins only');
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((public.admin_metrics() ->> 'challenge_entries')::int >= 1, 'a Forge admin sees the metrics');

reset role;
rollback;
\echo 'challenges tests: all passed'
