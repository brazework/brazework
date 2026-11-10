-- Tests for supabase/verification.sql: every rule, acting as real members through row-level
-- security. Runs inside one transaction and rolls back, so the database is unchanged.
-- Needs the e2e seed (josh, maya, ben, cara; Rocketry Club "rkt": ben owner, maya admin, josh member).
--   docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 < supabase/tests/verification.test.sql
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false), set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false);

-- Helpers, in a schema that disappears with the rollback.
create schema t;
grant usage on schema t to authenticated;
-- Act as someone (row-level security applies as for that member).
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
-- Run SQL and require it to fail with a message containing `needle`.
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

-- Josh's project.
select t.as_('josh'); set local role authenticated;
insert into public.projects (title, summary) values ('Fin test rig', 'Wind tunnel for fin shapes');
select set_config('t.project', (select id from public.projects where title = 'Fin test rig' and owner_id = current_setting('t.josh')::uuid), false);

-- Rule 2: evidence is required.
select t.must_fail($$insert into public.milestones (project_id, community_id, title) values (current_setting('t.project'), 'rkt', 'No evidence')$$, 'Add evidence first');
select t.must_fail($$insert into public.milestones (project_id, community_id, title, evidence_items) values (current_setting('t.project'), 'rkt', 'Bad evidence', '[{"type":"link","url":"javascript:alert(1)"}]')$$, 'milestones_evidence_ok');
insert into public.milestones (project_id, community_id, title, evidence_items)
values (current_setting('t.project'), 'rkt', 'Measured lift on 3 fins', '[{"type":"commit","url":"https://github.com/josh/fins/commit/abc123"}]');
select set_config('t.m1', (select id from public.milestones where title = 'Measured lift on 3 fins'), false);
select t.ok((select status = 'pending' and private from public.milestones where id = current_setting('t.m1')), 'with evidence it is pending, and private by default');
select t.ok((select count(*) = 1 from public.verification_events where milestone_id = current_setting('t.m1') and action = 'submitted'), 'submitting is logged');
-- Drafts may lack evidence, but can't be submitted without it.
insert into public.milestones (project_id, community_id, title, status) values (current_setting('t.project'), 'rkt', 'Draft idea', 'draft');
select t.must_fail($$select public.submit_milestone((select id from public.milestones where title = 'Draft idea'))$$, 'Add evidence first');

-- Rule 1: only officers, never their own project or one they're on.
select t.must_fail($$select public.review_milestone(current_setting('t.m1'), true)$$, 'You can''t verify a project you own');
insert into public.project_members (project_id, uid) values (current_setting('t.project'), current_setting('t.maya')::uuid);
reset role; select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.review_milestone(current_setting('t.m1'), true)$$, 'Only the club''s moderators');
reset role; select t.as_('maya'); set local role authenticated;
select t.must_fail($$select public.review_milestone(current_setting('t.m1'), true)$$, 'You can''t verify a project you own or are on');
reset role; select t.as_('josh'); set local role authenticated;
delete from public.project_members where project_id = current_setting('t.project');

-- Rule 3: a club can require 2 verifiers; two different officers.
reset role; select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.set_verifiers_required('rkt', 2)$$, 'Only the club''s owner and admins');
reset role; select t.as_('ben'); set local role authenticated;
select public.set_verifiers_required('rkt', 2);
reset role; select t.as_('josh'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, evidence_items)
values (current_setting('t.project'), 'rkt', 'Static fire passed', '[{"type":"link","url":"https://youtu.be/xyz"}]');
select set_config('t.m2', (select id from public.milestones where title = 'Static fire passed'), false);
reset role; select t.as_('maya'); set local role authenticated;
select t.ok(public.review_milestone(current_setting('t.m2'), true, 'Saw it') = 'pending', 'one of two approvals keeps it pending');
select t.must_fail($$select public.review_milestone(current_setting('t.m2'), true)$$, 'needs another officer');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok(public.review_milestone(current_setting('t.m2'), true) = 'verified', 'the second officer verifies it');
-- Rule 4: the badge says who, their role, the club and when.
select t.ok((select reviewer_name <> '' and reviewer_role = 'owner' and community_name = 'Rocketry Club' and reviewed_at is not null from public.milestones where id = current_setting('t.m2')), 'badge has verifier, role, club and date');

-- A verified record can't be deleted by its owner.
reset role; select t.as_('josh'); set local role authenticated;
delete from public.milestones where id = current_setting('t.m2');
reset role;
select t.ok((select count(*) = 1 from public.milestones where id = current_setting('t.m2')), 'the owner can''t delete a verified milestone');

-- Rule 6: revocation with a reason, by an officer; logged.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.revoke_milestone(current_setting('t.m2'), 'Changed my mind')$$, 'Only the club''s officers');
reset role; select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.revoke_milestone(current_setting('t.m2'), '')$$, 'Say why');
select public.revoke_milestone(current_setting('t.m2'), 'The video was from another team');
reset role;
select t.ok((select status = 'revoked' and revoked_reason <> '' from public.milestones where id = current_setting('t.m2')), 'revoked, with the reason');
select t.ok((select count(*) = 1 from public.verification_events where milestone_id = current_setting('t.m2') and action = 'revoked'), 'revocation is logged');

-- Rule 7: dispute → club owner → Forge admin.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.dispute_milestone(current_setting('t.m2'), 'no')$$, 'Explain what happened');
select public.dispute_milestone(current_setting('t.m2'), 'That video is ours: the launch rail and our club banner are in frame.');
reset role; select t.as_('maya'); set local role authenticated;
select t.must_fail($$select public.resolve_dispute(current_setting('t.m2'), true)$$, 'Only the club''s owner decides');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok(public.resolve_dispute(current_setting('t.m2'), false, 'Still not convinced') = 'escalated', 'the owner rejecting sends it to Forge admins');
reset role;
select t.ok((select count(*) = 1 from public.admin_queue where kind = 'dispute' and subject_id = current_setting('t.m2') and status = 'open'), 'the dispute is in the admin queue');
select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.admin_resolve_dispute(current_setting('t.m2'), true, 'ok')$$, 'Forge admins only');
reset role;
insert into public.forge_admins (uid) values (current_setting('t.cara')::uuid);
select t.as_('cara'); set local role authenticated;
select t.ok(public.admin_resolve_dispute(current_setting('t.m2'), true, 'Checked the footage') = 'verified', 'a Forge admin upholds it');
reset role;
select t.ok((select status = 'resolved' from public.admin_queue where kind = 'dispute' and subject_id = current_setting('t.m2')), 'the queue item is resolved');
select t.ok((select array_agg(action order by id) from public.verification_events where milestone_id = current_setting('t.m2'))
  = array['submitted', 'approved', 'approved', 'verified', 'revoked', 'disputed', 'dispute_rejected', 'escalated', 'admin_upheld'], 'the full history is logged in order');

-- The log is append-only, for everyone.
select t.must_fail($$update public.verification_events set note = 'edited' where milestone_id = current_setting('t.m2')$$, 'append-only');
select t.must_fail($$delete from public.verification_events where milestone_id = current_setting('t.m2')$$, 'append-only');

-- Rule 5: weekly cap per officer, and outliers flagged.
update public.communities set verifiers_required = 1 where id = 'rkt';
update public.app_config set value = '1' where key = 'verify_weekly_limit';
select t.as_('josh'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, evidence_items)
values (current_setting('t.project'), 'rkt', 'Recovery deployed', '[{"type":"link","url":"https://example.com/recovery"}]');
select set_config('t.m3', (select id from public.milestones where title = 'Recovery deployed'), false);
reset role; select t.as_('maya'); set local role authenticated;
select t.must_fail($$select public.review_milestone(current_setting('t.m3'), true)$$, 'this week''s verification limit');
reset role;
update public.app_config set value = '25' where key = 'verify_weekly_limit';
update public.app_config set value = '1' where key = 'verify_outlier_min';
update public.app_config set value = '0' where key = 'verify_outlier_factor';
select t.as_('maya'); set local role authenticated;
select t.ok(public.review_milestone(current_setting('t.m3'), true) = 'verified', 'under the cap, it verifies');
reset role;
select t.ok((select count(*) >= 1 from public.admin_queue where kind = 'verify_outlier' and subject_id = current_setting('t.maya')), 'an officer far above the club average is flagged');

-- Rule 8: officers lose verifying power when their role ends; members keep verified work when they leave.
select t.as_('josh'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, evidence_items)
values (current_setting('t.project'), 'rkt', 'Avionics bay printed', '[{"type":"link","url":"https://example.com/bay"}]');
reset role;
select set_config('t.m4', (select id from public.milestones where title = 'Avionics bay printed'), false);
update public.community_members set role = 'member' where community_id = 'rkt' and uid = current_setting('t.maya')::uuid;
select t.as_('maya'); set local role authenticated;
select t.must_fail($$select public.review_milestone(current_setting('t.m4'), true)$$, 'Only the club''s moderators');
reset role;
delete from public.community_members where community_id = 'rkt' and uid = current_setting('t.josh')::uuid;
select t.ok((select status = 'verified' from public.milestones where id = current_setting('t.m3')), 'a member who leaves keeps their verified milestone');

-- Rule 9: no verified-club mark without a school-email officer and enough verified members.
select t.ok(not public.club_is_verified('rkt'), 'Rocketry Club (no school-email officer, few verified members) is not a verified club');

-- Privacy: a private verified milestone isn't visible to other members; making it public shows it.
select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) = 0 from public.milestones where id = current_setting('t.m3')), 'a private milestone is hidden from others');
reset role; select t.as_('josh'); set local role authenticated;
update public.milestones set private = false where id = current_setting('t.m3');
reset role; select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) = 1 from public.milestones where id = current_setting('t.m3')), 'once public, verified work is visible');

reset role;
rollback;
\echo 'verification tests: all passed'
