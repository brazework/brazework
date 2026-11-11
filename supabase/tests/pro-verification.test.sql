-- Tests for supabase/pro-verification.sql: who can be a pro (email at a verified company), signing a
-- club-verified public milestone with a real note, the limits (own work, private, unverified, twice),
-- sign-offs never change, who can read them, and the review queue. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false), set_config('t.maya', :'maya', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- Cara's email is at Acme Aerospace (a verified company): she can be a pro, with her title and areas.
select t.as_('cara'); set local role authenticated;
select t.ok(public.my_employer()->>'name' = 'Acme Aerospace', 'the employer comes from the confirmed email');
select public.become_pro('Propulsion Engineer', array['Aerospace']);
reset role;
select t.ok((select pro_title = 'Propulsion Engineer' and pro_org_id is not null and pro_since is not null from public.profiles where id = current_setting('t.cara')::uuid), 'Cara is a pro at Acme');
select t.as_('maya'); set local role authenticated;
select t.ok((select pro_title = 'Propulsion Engineer' from public.profiles where id = current_setting('t.cara')::uuid), 'members can read a pro''s title');
reset role;
-- Nobody sets their employer or title by hand.
select t.as_('ben'); set local role authenticated;
do $$ begin update public.profiles set pro_org_id = (select id from public.organizations where name = 'Acme Aerospace') where id = auth.uid(); raise exception 'FAILED: an employer was set by hand'; exception when insufficient_privilege then raise notice 'ok: the employer can''t be typed in'; end $$;

-- The queue: Ben's club-verified public milestones, not Cara's own.
reset role; select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) > 0 from public.pro_review_queue() where id = 'm1'), 'm1 (club-verified, public) is in Cara''s queue');
select t.ok(not exists (select 1 from public.pro_review_queue() where id = 'm3'), 'a private milestone isn''t in the queue');

-- A real note is required.
do $$ begin perform public.pro_review_milestone('m1', 'Looks good.'); raise exception 'FAILED: a one-liner was accepted'; exception when raise_exception then raise notice 'ok: a short note is refused (%)', sqlerrm; end $$;
select t.ok(public.pro_review_milestone('m1', 'Watched the static fire video and checked the load cell log against the stated 1.2 kN peak.') > 0, 'Cara Pro-verifies m1 with what she checked');
select t.ok((select reviewer_name = 'Cara Diaz' and reviewer_title = 'Propulsion Engineer' and employer_name = 'Acme Aerospace' from public.pro_reviews where milestone_id = 'm1'), 'the sign-off records who, their title and employer');
do $$ begin perform public.pro_review_milestone('m1', 'Signing it a second time, which should not be allowed at all.'); raise exception 'FAILED: signed twice'; exception when raise_exception then raise notice 'ok: one sign-off per pro per milestone'; end $$;
do $$ begin perform public.pro_review_milestone('m3', 'This is a private milestone, which should be refused for review.'); raise exception 'FAILED: a private milestone was signed'; exception when raise_exception then raise notice 'ok: private milestones can''t be Pro-verified'; end $$;
select t.ok(not exists (select 1 from public.pro_review_queue() where id = 'm1'), 'a signed milestone leaves your queue');

-- Signed stays signed: no edits, no deletes.
do $$ begin update public.pro_reviews set note = 'changed my mind about what I checked here, edited after the fact' where milestone_id = 'm1'; raise exception 'FAILED: a sign-off was edited'; exception when insufficient_privilege then raise notice 'ok: sign-offs can''t be edited'; end $$;
do $$ begin delete from public.pro_reviews where milestone_id = 'm1'; raise exception 'FAILED: a sign-off was deleted'; exception when insufficient_privilege then raise notice 'ok: sign-offs can''t be deleted'; end $$;
reset role;
do $$ begin update public.pro_reviews set note = 'even the owner session cannot edit what was signed by the pro' where milestone_id = 'm1'; raise exception 'FAILED: edited as owner'; exception when insufficient_privilege then raise notice 'ok: frozen even for the database owner'; end $$;

-- Not your own work; and you have to be a pro.
select t.as_('ben'); set local role authenticated;
do $$ begin perform public.pro_review_milestone('m1', 'Reviewing my own milestone, which should be refused outright.'); raise exception 'FAILED: a non-pro signed'; exception when insufficient_privilege then raise notice 'ok: only pros sign'; end $$;

-- Anyone signed in reads a public milestone's sign-off.
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 1 from public.pro_reviews where milestone_id = 'm1'), 'members read the sign-off on a public milestone');

reset role;
select t.ok(public.pro_verification_ready(), 'the app can tell the step has run');

rollback;
\echo 'pro-verification tests: all passed'
