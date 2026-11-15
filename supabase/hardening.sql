-- Hardening (from Supabase's Security and Performance advisors, 2026-11-15). Run after school-links.sql.
-- Additive and safe to run again; changes no data and no rules about who can see what.
--
-- 1. Every function in public gets a fixed search_path. Without one, a function runs with the
--    caller's search_path, so a caller who can create objects in a schema earlier on that path can
--    swap in their own table or function. This pins the path to what the app already uses
--    (public, then extensions), so nothing resolves differently. Functions that already set one,
--    and functions owned by an extension, are left alone. New steps should keep writing
--    `set search_path = public` on their functions; this catches any that don't the next time it runs.
-- 2. Five functions that only make sense signed in can no longer be called signed out. Each already
--    refused or returned nothing without a user; this removes the door instead of relying on the lock.
--    Functions signed-out pages use on purpose (invite and vouch previews, public club reports,
--    network pages, public stats, sign-up checks, the MCP token functions) keep their access.
-- 3. Four foreign keys get the index Postgres needs to join and delete through them quickly.

-- 1. A fixed search_path on every function that lacks one.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f);
  end loop;
end $$;

-- 2. Signed-in only: every version of these functions.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('club_report_link', 'revoke_club_report_link', 'request_vouch', 'my_school', 'my_employer')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- 3. Indexes for foreign keys that had none.
create index if not exists communities_school_domain_idx on public.communities (school_domain) where school_domain is not null;
create index if not exists pro_reviews_employer_id_idx on public.pro_reviews (employer_id) where employer_id is not null;
create index if not exists profiles_pro_org_id_idx on public.profiles (pro_org_id) where pro_org_id is not null;
create index if not exists project_repos_linked_by_idx on public.project_repos (linked_by) where linked_by is not null;

-- Lets the health check (and db-migrate.yml) see this step has run.
create or replace function public.hardening_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.hardening_ready() to authenticated;
