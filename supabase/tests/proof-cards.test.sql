-- Tests for supabase/proof-cards.sql: only the owner shares, only signed or backed work, only on a
-- public project; someone signed out sees a shared result through public_proof() and nothing else
-- (not unshared, hidden, revoked, refused or others' work); stopping sharing takes it down; and
-- nobody can set shared_at directly. Runs in one transaction; rolls back.
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

-- Ben's signed milestone m1 (seed), kept private for now; a pending one; a backed one.
update public.milestones set private = true where id = 'm1';
alter table public.milestones disable trigger user;
insert into public.milestones (id, project_id, owner_id, community_id, title, evidence, status, private) values
  ('pc-pending', 'p1', :'ben', 'rkt', 'Still waiting', 'https://example.com/a', 'pending', false),
  ('pc-draft', 'p1', :'ben', null, 'Nobody asked yet', 'https://example.com/d', 'draft', false),
  ('pc-backed', 'p1', :'ben', null, 'Parser merged', 'https://github.com/bencho/test-stand/pull/3', 'logged', true);
alter table public.milestones enable trigger user;
insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id) values ('pc-backed', 'pull_request', 'https://github.com/bencho/test-stand/pull/3', 'bencho/test-stand', '3', 501);

-- Nothing is public until shared.
set local role anon;
select t.ok(public.public_proof('m1') is null, 'an unshared result shows nothing signed out');
reset role;

-- Only the owner, only signed or backed work.
select t.as_('maya'); set local role authenticated;
select t.refused($$select public.share_milestone('m1', true)$$, 'P0001', 'nobody shares someone else''s result');
reset role;
select t.as_('ben'); set local role authenticated;
-- Work waiting for a signature can be shared as a waiting card (supabase/waiting-cards.sql, tested there);
-- a draft that nobody was asked to sign can't.
select t.refused($$select public.share_milestone('pc-draft', true)$$, 'P0001', 'a draft nobody was asked to sign can''t be shared');
select t.refused($$update public.milestones set shared_at = now() where id = 'm1'$$, '42501', 'shared_at can''t be set directly');
select public.share_milestone('m1', true) as s1 \gset
select public.share_milestone('pc-backed', true) as s2 \gset
reset role;
select t.ok((select shared_at is not null and not private from public.milestones where id = 'm1'), 'sharing a result shows it on the profile too');

-- Signed out: the shared results, with the right level and witness, and no private fields.
set local role anon;
select t.ok((public.public_proof('m1')->>'level') = 'signed' and (public.public_proof('m1')->'witness'->>'club') <> '', 'a shared signed result shows its witness');
select t.ok((public.public_proof('pc-backed')->>'level') = 'backed' and (public.public_proof('pc-backed')->'backing'->>'ref') = '3', 'a shared backed result shows what backs it');
select t.ok(not (public.public_proof('m1') ? 'review_note') and not (public.public_proof('m1') ? 'dispute_note'), 'no notes go public');
select t.ok(public.public_proof('pc-pending') is null and public.public_proof('nope') is null, 'anything else shows nothing');
reset role;

-- Hidden, revoked, or on a project made private: gone.
update public.milestones set private = true where id = 'm1';
set local role anon; select t.ok(public.public_proof('m1') is null, 'hiding it takes the link down'); reset role;
update public.milestones set private = false, status = 'revoked' where id = 'm1';
set local role anon; select t.ok(public.public_proof('m1') is null, 'a revoked result is never public'); reset role;
update public.milestones set status = 'verified' where id = 'm1';
update public.projects set private = true where id = 'p1';
set local role anon; select t.ok(public.public_proof('m1') is null, 'a private project''s results are never public'); reset role;
select t.as_('ben'); set local role authenticated;
select t.refused($$select public.share_milestone('m1', true)$$, 'P0001', 'a private project''s results can''t be shared');
reset role;
update public.projects set private = false where id = 'p1';

-- Stop sharing.
select t.as_('ben'); set local role authenticated;
select public.share_milestone('m1', false) as s3 \gset
reset role;
set local role anon; select t.ok(public.public_proof('m1') is null, 'stopping sharing takes it down'); reset role;

rollback;
\echo 'proof-card tests: all passed'
