-- Tests for supabase/waiting-cards.sql: a milestone waiting for its signature can be shared; its card
-- says it's waiting and who was asked (the club, or the kind of person and their domain, never the
-- address); the same link becomes the signed card once it's signed; a refused one stops showing; and
-- the signed card still carries the witness's count. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.ben', :'ben', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben: one waiting for Rocketry Club, one waiting for a professor he asked by email.
alter table public.milestones disable trigger user;
insert into public.milestones (id, project_id, owner_id, community_id, title, evidence, status, private) values
  ('wc-club', 'p1', :'ben', 'rkt', 'Static fire at 1.2 kN', 'https://example.com/a', 'pending', true),
  ('wc-prof', 'p1', :'ben', null, 'Load cell calibrated', 'https://example.com/b', 'pending', true);
alter table public.milestones enable trigger user;
insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash)
values ('wc-prof', :'ben', 'prof.lee@utexas.edu', 'professor', repeat('7', 64));

select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.share_milestone('wc-club', true);
select public.share_milestone('wc-prof', true);
reset role;

set local role anon;
select public.public_proof('wc-club') as club \gset
select public.public_proof('wc-prof') as prof \gset
reset role;
select t.ok(:'club'::jsonb ->> 'level' = 'waiting', 'a shared milestone waiting for its club shows as waiting, signed out');
select t.ok(:'club'::jsonb -> 'waiting_for' ->> 'club' = (select name from public.communities where id = 'rkt'), 'and names the club it waits for');
select t.ok(:'club'::jsonb -> 'witness' = 'null'::jsonb, 'with no witness: nobody has signed it');
select t.ok(:'prof'::jsonb -> 'waiting_for' -> 'asked' = '{"relationship": "professor", "domain": "utexas.edu"}'::jsonb, 'one asked by email names a professor at utexas.edu');
select t.ok(position('prof.lee' in :'prof') = 0, 'and never their address');
select t.ok((select not private from public.milestones where id = 'wc-prof'), 'sharing shows it on the profile, as before');

-- The club verifies it: the same link is now the signed card, with the witness's count.
update public.milestones set status = 'verified', reviewer_name = 'Maya Patel', reviewed_at = now() where id = 'wc-club';
set local role anon;
select t.ok(public.public_proof('wc-club') ->> 'level' = 'signed', 'once signed, the same link shows the signed card');
select t.ok(public.public_proof('wc-club') -> 'waiting_for' = 'null'::jsonb, 'and no longer says it''s waiting');
select t.ok(public.public_proof('wc-club') -> 'witness' ? 'signed_count', 'the signed card still carries the witness''s count');
reset role;

-- The professor declines: the link stops showing.
update public.milestones set status = 'declined' where id = 'wc-prof';
set local role anon;
select t.ok(public.public_proof('wc-prof') is null, 'a declined milestone stops showing');
reset role;

\echo 'waiting-cards: all passed'
rollback;
