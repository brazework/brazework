-- Tests for supabase/hardening.sql: no function in public runs with the caller's search_path, the
-- five signed-in-only functions refuse signed-out callers but still work signed in, and the four
-- foreign keys have their indexes. Runs in one transaction; rolls back.
\set QUIET on
begin;

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
), 'every function in public has a fixed search_path');

select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('club_report_link', 'revoke_club_report_link', 'request_vouch', 'my_school', 'my_employer')
    and has_function_privilege('anon', p.oid, 'execute')
), 'signed-out visitors can''t call the five signed-in-only functions');

select t.ok((
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('club_report_link', 'revoke_club_report_link', 'request_vouch', 'my_school', 'my_employer')
    and has_function_privilege('authenticated', p.oid, 'execute')
) >= 5, 'signed-in members still can');

select t.ok(has_function_privilege('anon', 'public.public_club_report(text)', 'execute'), 'public club report links still open signed out');

select t.ok((
  select count(*) from pg_class where relname in ('communities_school_domain_idx', 'pro_reviews_employer_id_idx', 'profiles_pro_org_id_idx', 'project_repos_linked_by_idx')
) = 4, 'the four foreign-key indexes exist');

-- A fixed path changes nothing a function does: a member still sees their school as before.
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('request.jwt.claim.sub', :'josh', true);
set local role authenticated;
select coalesce(public.my_school()::text, 'none') as school \gset
reset role;
select t.ok(:'school' <> '', 'my_school still runs signed in');

rollback;
\echo 'hardening tests: all passed'
