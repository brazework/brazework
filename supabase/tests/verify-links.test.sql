-- Tests for supabase/verify-links.sql: the résumé verify page (/v/<id>) shows a milestone to anyone,
-- signed out too, only while it and its project are public and only once it was signed; it shows who
-- signed, their role and when; a revoked milestone stays, marked revoked, without the reason; private
-- evidence is counted, never linked. Runs in one transaction; rolls back.
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
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- A vouched milestone with a link, a commit and a club event as evidence.
update public.milestones set evidence_items = '[{"type": "link", "url": "https://example.com/report"}, {"type": "commit", "url": "https://github.com/acme/rig/commit/abc1234"}, {"type": "event", "event_id": "ev-1"}]'::jsonb
 where id = 'm2';
-- (Triggers off while seeding, as in e2e/seed.sql.)
set local session_replication_role = replica;
insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, evidence, status) values
  ('vpend', 'p1', :'ben', 'rkt', 'Rocketry Club', 'Waiting for the club', 'https://example.com/x', 'pending');
insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, status, reviewer_name, reviewed_at, private) values
  ('vpriv', 'p1', :'ben', 'rkt', 'Rocketry Club', 'Private but signed', 'verified', 'Maya Patel', now(), true);
set local session_replication_role = origin;

-- ---------- Signed out ----------
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.public_verify('m1') as v1 \gset
select t.ok((:'v1'::jsonb->>'state') = 'valid' and (:'v1'::jsonb->>'title') = 'Static fire at 1.2 kN', 'a signed, public milestone has a verify page, signed out');
select t.ok((:'v1'::jsonb->'signer'->>'name') = 'Maya Patel' and (:'v1'::jsonb->'signer'->>'club') = 'Rocketry Club' and (:'v1'::jsonb->'signer'->>'at') is not null,
  'it says who signed it, for which club, and when');
select t.ok((:'v1'::jsonb->'member'->>'first') = 'Ben' and (:'v1'::jsonb->>'project') = 'Liquid engine test stand', 'and whose work it is, on which project');
select t.ok(public.public_verify('m3') is null, 'a milestone on a private project has no page');
select t.ok(public.public_verify('vpriv') is null, 'a private milestone has no page');
select t.ok(public.public_verify('vpend') is null, 'a milestone that was never signed has no page');
select t.ok(public.public_verify('no-such-id') is null, 'an unknown id shows nothing');
select public.public_verify('m2') as v2 \gset
select t.ok((:'v2'::jsonb->'evidence') = '[{"url": "https://example.com/report", "type": "link"}, {"url": "https://github.com/acme/rig/commit/abc1234", "type": "commit"}]'::jsonb
  and (:'v2'::jsonb->>'kept_private')::int = 1, 'links and commits show; a club event is counted, not linked');
select t.ok(not has_table_privilege('anon', 'public.milestones', 'select'), 'signed out, the table itself stays closed (members only)');
reset role;

-- ---------- Revoked: the page stays, marked revoked, without the reason ----------
select t.as_('maya'); set local role authenticated;
select public.revoke_milestone('m1', 'The thrust data was from a different motor.');
reset role;
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select public.public_verify('m1') as r1 \gset
select t.ok((:'r1'::jsonb->>'state') = 'revoked' and (:'r1'::jsonb->>'revoked_at') is not null, 'a revoked milestone is marked revoked, with when');
select t.ok(position('different motor' in :'r1') = 0, 'the revocation''s reason isn''t shown');
select t.ok((:'r1'::jsonb->'signer'->>'name') = 'Maya Patel', 'who signed it originally still shows');
reset role;
select t.as_('ben'); set local role authenticated;
select public.dispute_milestone('m1', 'It was the same motor; the log has the serial number.');
reset role;
set local role anon;
select t.ok((public.public_verify('m1')->>'state') = 'disputed', 'a disputed revocation says so');
reset role;

-- ---------- Making it private takes the page down ----------
update public.milestones set private = true where id = 'm2';
set local role anon;
select t.ok(public.public_verify('m2') is null, 'making a milestone private takes its page down');
reset role;
update public.projects set private = true where id = 'p1';
set local role anon;
select t.ok(public.public_verify('m1') is null, 'and so does making its project private');
reset role;

select 'verify-links: all passed' as passed;
rollback;
