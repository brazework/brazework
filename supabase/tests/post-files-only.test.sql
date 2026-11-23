-- Tests for supabase/post-files-only.sql (Linear FIX-247): a project update or a photo post may have no
-- text; any other post still needs some. Runs in one transaction and rolls back. Needs the e2e seed
-- (Ben owns project p1).
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.ben', :'ben', false);

create schema t;
grant usage on schema t to authenticated;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.refused(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when check_violation then return true; end $$;
grant execute on all functions in schema t to authenticated;

select set_config('request.jwt.claim.sub', :'ben', true);
set local role authenticated;
select t.ok(not t.refused($q$insert into public.posts (body, project_id, kind) values ('', 'p1', 'project')$q$), 'a project update can be just its files');
select t.ok(t.refused($q$insert into public.posts (body, kind) values ('', 'update')$q$), 'a plain post still needs text');
select t.ok(t.refused($q$insert into public.posts (body, kind) values ('   ', 'update')$q$), 'spaces alone don''t count as text');
select t.ok(not t.refused($q$insert into public.posts (body, kind) values ('Static fire on Saturday', 'update')$q$), 'a post with text is fine');
select t.ok(t.refused(format($q$insert into public.posts (body, project_id, kind) values (%L, 'p1', 'project')$q$, repeat('x', 3001))), 'nothing is longer than 3,000 characters');
reset role;

\echo 'post-files-only: all passed'
rollback;
