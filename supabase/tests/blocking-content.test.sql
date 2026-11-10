-- Tests for supabase/blocking-content.sql, acting as real members. Runs in one transaction and rolls
-- back. Needs the e2e seed: Ben owns Rocketry Club (rkt) and posted in it; Josh is a member; Maya
-- is a club admin there.
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

create schema t;
grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant execute on all functions in schema t to authenticated;

-- Josh posts in the club and on his feed, and replies to Ben's club post (the database fills in
-- who wrote them).
select t.as_('josh'); set local role authenticated;
insert into public.posts (body, kind, community_id) values ('Josh club update for the block test', 'update', 'rkt');
insert into public.posts (body, kind) values ('Josh feed update for the block test', 'update');
insert into public.comments (post_id, body)
  select id, 'Josh reply for the block test' from public.posts where community_id = 'rkt' and author_id = current_setting('t.ben')::uuid limit 1;
select t.ok((select count(*) > 0 from public.posts where community_id = 'rkt' and author_id = current_setting('t.ben')::uuid), 'before blocking, Josh sees Ben''s club posts');

-- Josh (a plain member of Ben's club) blocks Ben.
select public.block_user(current_setting('t.ben')::uuid);
select t.ok((select count(*) = 0 from public.posts where author_id = current_setting('t.ben')::uuid), 'the blocker no longer sees the blocked person''s posts, even in a club they share');
select t.ok((select count(*) > 0 from public.posts where author_id = current_setting('t.josh')::uuid), 'Josh still sees his own posts');
select t.ok((select count(*) = 0 from public.comments c join public.posts p on p.id = c.post_id where p.author_id = current_setting('t.ben')::uuid), 'replies on the hidden posts are hidden with them');
reset role;

select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) = 0 from public.posts where author_id = current_setting('t.josh')::uuid and community_id is null), 'the blocked person can''t see the blocker''s feed posts');
select t.ok((select public.blocked_between(current_setting('t.ben')::uuid, current_setting('t.josh')::uuid)), 'blocked_between sees a block the other person made');
-- Ben owns the club, so he still sees what's posted in it, including replies on his own posts:
-- an owner can't moderate posts they can't see.
select t.ok((select count(*) > 0 from public.posts where community_id = 'rkt' and author_id = current_setting('t.josh')::uuid), 'a club owner still sees blocked members'' posts in their own club (moderation)');
select t.ok((select count(*) = 0 from public.comments where author_id = current_setting('t.josh')::uuid), 'but not the blocker''s replies');
select t.ok((select count(*) > 0 from public.posts where author_id = current_setting('t.ben')::uuid), 'Ben still sees his own posts');
reset role;

-- Another club admin sees both, for moderation.
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) > 0 from public.posts where community_id = 'rkt' and author_id = current_setting('t.josh')::uuid)
       and (select count(*) > 0 from public.posts where community_id = 'rkt' and author_id = current_setting('t.ben')::uuid), 'club moderators still see both members'' posts');
reset role;

-- Unblocking brings everything back.
select t.as_('josh'); set local role authenticated;
delete from public.message_blocks where blocker = current_setting('t.josh')::uuid and blocked = current_setting('t.ben')::uuid;
select t.ok((select count(*) > 0 from public.posts where author_id = current_setting('t.ben')::uuid), 'after unblocking, Josh sees Ben''s posts again');
reset role;

-- Nobody outside can use the check to probe who blocked whom.
select t.ok(not has_function_privilege('anon', 'public.blocked_between(uuid, uuid)', 'execute'), 'anonymous visitors can''t call blocked_between');

rollback;
\echo 'blocking-content tests: all passed'
