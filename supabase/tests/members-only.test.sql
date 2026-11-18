-- Tests for supabase/members-only.sql (Linear FIX-138): a signed-in account with no profile reads no
-- member data from any table, can still finish signing up, and members see exactly what they saw
-- before. Counts every table the authenticated role can read, with the "members only" policies and
-- then (inside this transaction) without them. Also fails if a table is readable without the policy.
-- The project-files storage policy isn't covered: the CI database has no Storage. Rolls back.
\set QUIET on
begin;
create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, true); end $$;
-- Every public table the authenticated role can read (a table or any of its columns).
create function t.readable() returns setof text language sql stable as $$
  select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and has_any_column_privilege('authenticated', c.oid, 'select')
$$;
-- How many rows of each the current caller sees.
create table t.seen (who text, phase text, tbl text, n bigint);
create function t.count_as(who text, phase text) returns void language plpgsql as $$
declare r text; c bigint;
begin
  for r in select t.readable() loop
    execute format('select count(*) from public.%I', r) into c;
    insert into t.seen values (who, phase, r, c);
  end loop;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;
grant select, insert on t.seen to authenticated;

-- Two members (email sign-ups: the trigger makes their profiles), an OAuth newcomer who hasn't done
-- About you, and an account made straight through the Auth API with no sign-up details at all.
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  (gen_random_uuid(), 'authenticated', 'authenticated', 'ana.members@gmail.com', now(), '{"accountType": "professional", "firstName": "Ana", "lastName": "Ruiz", "birthday": "1990-01-01"}'),
  (gen_random_uuid(), 'authenticated', 'authenticated', 'bo.members@gmail.com', now(), '{"accountType": "professional", "firstName": "Bo", "lastName": "Park", "birthday": "1991-01-01"}');
select id as ana from auth.users where email = 'ana.members@gmail.com' \gset
select id as bo from auth.users where email = 'bo.members@gmail.com' \gset
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), 'authenticated', 'authenticated', 'newbie.members@gmail.com', now(),
        '{"provider": "github", "providers": ["github"]}', '{"full_name": "New Bie", "email_verified": true}')
returning id as newbie \gset
insert into auth.users (id, aud, role, email, email_confirmed_at)
values (gen_random_uuid(), 'authenticated', 'authenticated', 'raw.members@gmail.com', now())
returning id as raw \gset
select t.ok((select count(*) = 2 from public.profiles where id in (:'ana', :'bo')), 'the members have profiles');
select t.ok(not exists (select 1 from public.profiles where id in (:'newbie', :'raw')), 'the newcomer and the raw API sign-up have none');

-- Some of everything: a club with both members, a post with a like and a comment, a project, a
-- follow, and a direct message.
insert into public.communities (name, type, privacy) values ('Members Only Rocketry', 'field', 'public') returning id as club \gset
insert into public.community_members (community_id, uid) values (:'club', :'ana'), (:'club', :'bo') on conflict do nothing;
select t.as_(:'ana'); set local role authenticated;
insert into public.posts (body) values ('Static fire went well') returning id as post \gset
insert into public.likes (post_id) values (:'post');
insert into public.comments (post_id, body) values (:'post', 'Nice');
insert into public.projects (title, summary) values ('Members Only Rocket', 'A small rocket');
insert into public.follows (target) values (:'bo');
select public.start_conversation(:'bo') as conv \gset
insert into public.messages (conversation_id, body) values (:'conv', 'Hi Bo');
reset role;
select t.ok((select count(*) > 0 from public.messages where conversation_id = :'conv'), 'the test data is in place');

-- ---------- With the "members only" policies ----------
select t.as_(:'ana'); set local role authenticated; select t.count_as('ana', 'with'); reset role;
select t.as_(:'bo'); set local role authenticated; select t.count_as('bo', 'with'); reset role;
select t.as_(:'newbie'); set local role authenticated; select t.count_as('newbie', 'with');
select t.ok(not public.is_member(), 'is_member() is false without a profile');
reset role;
select t.as_(:'raw'); set local role authenticated; select t.count_as('raw', 'with'); reset role;

select t.ok(not exists (select 1 from t.seen where who in ('newbie', 'raw') and phase = 'with' and n > 0),
  'without a profile, every table reads empty: ' || coalesce((select string_agg(who || ':' || tbl, ', ') from t.seen where who in ('newbie', 'raw') and phase = 'with' and n > 0), 'none'));
select t.ok((select n > 0 from t.seen where who = 'bo' and phase = 'with' and tbl = 'messages'), 'a member reads their messages');
select t.ok((select n > 0 from t.seen where who = 'bo' and phase = 'with' and tbl = 'profiles'), 'a member reads profiles');

-- Finishing sign-up still works without a profile.
select t.as_(:'newbie'); set local role authenticated;
select t.ok(public.is_school_email('newbie.members@gmail.com') = false, 'is_school_email() answers');
select t.ok(public.invite_preview('no-such-code') is null, 'invite_preview() answers');
select t.ok(public.request_school('members-only-college.edu', 'Members Only College', '') is not null, 'request_school() answers');
select public.finish_signup('professional', 'New', 'Bie', '1995-01-01');
select t.ok(public.is_member(), 'after finish_signup() they are a member');
select t.ok((select count(*) > 0 from public.posts where id = :'post'), 'and they read member data like any member');
select t.ok((select first_name = 'New' from public.profiles where id = auth.uid()), 'including their own new profile');
reset role;

-- Signed-out pages are unchanged; is_member() itself is for signed-in callers.
set local role anon;
select t.ok(public.public_stats() is not null, 'public_stats() still answers signed-out visitors');
select t.ok(not has_function_privilege('anon', 'public.is_member()', 'execute'), 'anon can''t call is_member()');
reset role;

-- ---------- Every readable table has the policy ----------
select t.ok(not exists (
  select 1 from t.readable() r
  where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r
                      and p.permissive = 'RESTRICTIVE' and p.cmd = 'SELECT' and 'authenticated' = any (p.roles)
                      and p.qual like '%is_member()%')),
  'every table signed-in accounts can read has a "members only" policy (add one in the new table''s step): '
  || coalesce((select string_agg(r, ', ') from t.readable() r where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r and p.permissive = 'RESTRICTIVE' and p.qual like '%is_member()%')), 'none'));

-- ---------- Without them (this transaction only): members lose nothing, and the gap was real ----------
-- (Counted again first: finishing sign-up above added a profile and a school request.)
select t.as_(:'ana'); set local role authenticated; select t.count_as('ana', 'last'); reset role;
select t.as_(:'bo'); set local role authenticated; select t.count_as('bo', 'last'); reset role;
do $$ declare r record;
begin
  for r in select tablename from pg_policies where schemaname = 'public' and policyname = 'members only' loop
    execute format('drop policy "members only" on public.%I', r.tablename);
  end loop;
end $$;
select t.as_(:'ana'); set local role authenticated; select t.count_as('ana', 'without'); reset role;
select t.as_(:'bo'); set local role authenticated; select t.count_as('bo', 'without'); reset role;
select t.as_(:'raw'); set local role authenticated; select t.count_as('raw', 'without'); reset role;

select t.ok(not exists (
  select 1 from t.seen w join t.seen o on o.who = w.who and o.tbl = w.tbl and o.phase = 'without'
  where w.phase = 'last' and w.n <> o.n),
  'members see exactly what they saw before, in every table: differences ' || coalesce((select string_agg(w.who || ':' || w.tbl || ' ' || w.n || '/' || o.n, ', ')
    from t.seen w join t.seen o on o.who = w.who and o.tbl = w.tbl and o.phase = 'without' where w.phase = 'last' and w.n <> o.n), 'none'));
select t.ok((select bool_and(n > 0) from t.seen where who = 'raw' and phase = 'without' and tbl in ('profiles', 'posts', 'communities', 'community_members', 'projects', 'likes', 'follows', 'comments')),
  'before this step, an account with no profile could read profiles, posts, clubs, projects, likes, follows and comments');

rollback;
\echo 'members-only tests: all passed'
