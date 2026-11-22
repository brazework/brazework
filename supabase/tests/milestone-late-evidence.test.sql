-- Tests for supabase/milestone-late-evidence.sql (step 90, Linear FIX-238): a milestone's owner adds
-- evidence after logging it; evidence added after signing says so. Runs in one transaction and rolls
-- back. Needs the e2e seed: Ben owns milestone m1 (verified by Rocketry Club); Josh is another member.
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false);

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

-- A pending milestone of Ben's, with its first link.
select t.as_('ben');
insert into public.milestones (id, project_id, community_id, title, detail, evidence, private)
values ('late1', 'p1', 'rkt', 'Late evidence test', 'Thrust stand', 'https://github.com/bencho/stand', false);
select t.ok((select status = 'pending' from public.milestones where id = 'late1'), 'the test milestone is waiting for review');

-- ---------- Who can add ----------
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.add_milestone_evidence('late1', 'https://github.com/bencho/stand/pull/2')$$, 'Only the milestone''s owner');
reset role;

-- ---------- Adding while it waits ----------
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.add_milestone_evidence('late1', 'not a link')$$, 'full https:// link');
select t.must_fail($$select public.add_milestone_evidence('late1', 'http://github.com/bencho/stand/pull/2')$$, 'full https:// link');
select t.must_fail($$select public.add_milestone_evidence('late1', 'https://github.com/bencho/stand')$$, 'already on this milestone');
select public.add_milestone_evidence('late1', 'https://cad.onshape.com/documents/abc123');
select public.add_milestone_evidence('late1', 'https://github.com/bencho/stand/commit/9f1c2ab');
select t.must_fail($$select public.add_milestone_evidence('late1', 'https://cad.onshape.com/documents/abc123')$$, 'already on this milestone');
reset role;
select t.ok((select jsonb_array_length(evidence_items) = 2
                and evidence_items->0->>'type' = 'link' and evidence_items->1->>'type' = 'commit'
                and not (evidence_items->0->>'after_signing')::boolean and evidence_items->0 ? 'added_at'
               from public.milestones where id = 'late1'),
  'links are added in order, a commit is recognised, and nothing is marked as after signing yet');

-- ---------- Adding after it's signed ----------
update public.milestones set status = 'verified', reviewer_name = 'Test officer', reviewed_at = now() where id = 'late1';
select t.as_('ben'); set local role authenticated;
select public.add_milestone_evidence('late1', 'https://docs.google.com/document/d/writeup');
reset role;
select t.ok((select status = 'verified' and (evidence_items->2->>'after_signing')::boolean and not (evidence_items->0->>'after_signing')::boolean
               from public.milestones where id = 'late1'),
  'after signing, the milestone stays signed and the new evidence says it came later');

-- ---------- Limits ----------
select t.as_('ben'); set local role authenticated;
select public.add_milestone_evidence('late1', 'https://example.org/e' || g) from generate_series(1, 5) g;
select t.must_fail($$select public.add_milestone_evidence('late1', 'https://example.org/one-too-many')$$, 'up to 8 pieces');
reset role;
update public.milestones set status = 'disputed' where id = 'late1';
update public.milestones set evidence_items = '[]'::jsonb where id = 'late1';
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.add_milestone_evidence('late1', 'https://example.org/while-disputed')$$, 'being looked at');
reset role;

select t.ok(public.milestone_late_evidence_ready(), 'the app can tell the step has run');

rollback;
\echo 'milestone-late-evidence tests: all passed'
