-- Tests for supabase/witness-invites.sql: sharing a signed result tells the member who signed it, once,
-- with a notification that points at the card; the card says how many results that witness has
-- signed; and nobody else is told. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Maya signed Ben's static fire (m1).
update public.milestones set reviewer_id = :'maya', reviewer_name = 'Maya Patel' where id = 'm1';
delete from public.notifications where kind = 'proof_shared';

select t.as_('ben'); set local role authenticated;
select public.share_milestone('m1', true) as s1 \gset
reset role;
select t.ok((select count(*) = 1 from public.notifications where user_id = :'maya' and kind = 'proof_shared' and actor_id = :'ben' and milestone_id = 'm1'), 'the witness is told, and the notice opens the card');
select t.ok((select count(*) = 0 from public.notifications where kind = 'proof_shared' and user_id <> :'maya'), 'nobody else is told');

-- Sharing again, or stopping and sharing again, doesn't pile up notices.
select t.as_('ben'); set local role authenticated;
select public.share_milestone('m1', true) as s2 \gset
select public.share_milestone('m1', false) as s3 \gset
select public.share_milestone('m1', true) as s4 \gset
reset role;
select t.ok((select count(*) = 1 from public.notifications where user_id = :'maya' and kind = 'proof_shared'), 'one notice, however often it is shared');

-- The witness sees it in their own notifications; Ben can't read Maya's.
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 1 from public.notifications where kind = 'proof_shared'), 'the witness can read their notice');
reset role;
select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) = 0 from public.notifications where kind = 'proof_shared'), 'the sharer can''t read the witness''s notices');
reset role;

-- The card says how many results the witness has signed.
select count(*) as signed from public.milestones where reviewer_id = :'maya' and status = 'verified' \gset
select set_config('t.signed', :'signed', false);
set local role anon;
select t.ok(((public.public_proof('m1')->'witness'->>'signed_count')::int) = current_setting('t.signed')::int, 'the card counts the witness''s signed results');
reset role;

rollback;
\echo 'witness-invite tests: all passed'
