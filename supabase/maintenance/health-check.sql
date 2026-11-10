-- Forge database health check. READ-ONLY: every statement is a SELECT; nothing is changed.
-- Paste into Supabase → SQL Editor and run. Each block's result shows in turn (or run one block at a
-- time). Also open Supabase → Advisors (Security and Performance) for Supabase's own checks.

-- 1. Which migration steps (supabase/order.txt) this database has. "missing" = run that file next,
--    in order. Each row checks for one object the step creates.
select step, file, case when present then 'applied' else 'missing' end as status
from (values
  (5,  'club-events',     to_regclass('public.events') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'community_id')),
  (6,  'media',           exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'posts' and column_name = 'media')),
  (7,  'invites',         to_regclass('public.community_invites') is not null),
  (9,  'copilot',         to_regprocedure('public.copilot_ready()') is not null),
  (10, 'milestones',      to_regclass('public.milestones') is not null),
  (12, 'integrations',    to_regclass('public.club_integrations') is not null),
  (13, 'group-chats',     to_regclass('public.chats') is not null),
  (16, 'project-posts',   to_regprocedure('public.project_posts_ready()') is not null),
  (17, 'verification',    to_regclass('public.verification_events') is not null),
  (18, 'club-handoff',    to_regclass('public.club_handoffs') is not null),
  (19, 'public-stats',    to_regprocedure('public.public_stats()') is not null),
  (20, 'account',         to_regprocedure('public.delete_my_account(text)') is not null),
  (21, 'challenges',      to_regclass('public.challenges') is not null),
  (22, 'admin-metrics',   to_regprocedure('public.admin_metrics()') is not null),
  (23, 'rate-limits',     to_regprocedure('public.posts_pace()') is not null),
  (24, 'reports-more',    to_regprocedure('public.resolve_report(bigint,text)') is not null),
  (25, 'signup-rules',    to_regclass('public.school_domains') is not null),
  (26, 'school-requests', to_regclass('public.school_requests') is not null),
  (27, 'club-duplicates', to_regprocedure('public.flag_duplicate_club()') is not null),
  (28, 'club-reports',    to_regclass('public.club_report_links') is not null),
  (29, 'project-specs',   exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'project_details' and column_name = 'specs')),
  (30, 'email-digest',    to_regclass('public.email_prefs') is not null),
  (31, 'indexes',         to_regclass('public.comments_author_id_fk_idx') is not null),
  (32, 'blocking-content', to_regprocedure('public.blocked_between(uuid,uuid)') is not null),
  (33, 'admin-retention', to_regprocedure('public.admin_retention()') is not null),
  (34, 'grad-year',       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'grad_year'))
) as s(step, file, present)
order by step;

-- 2. Tables anyone could read or write: public tables with row-level security OFF (should be none).
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 3. Foreign keys with no index on their column (slow joins and deletes as data grows).
select tc.relname as "table", a.attname as "column", con.conname as foreign_key
from pg_constraint con
join pg_class tc on tc.oid = con.conrelid
join pg_namespace n on n.oid = tc.relnamespace and n.nspname = 'public'
join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
where con.contype = 'f'
  and not exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indkey[0] = con.conkey[1])
order by 1, 2;

-- 4. The biggest tables (rows are estimates).
select c.relname as "table", c.reltuples::bigint as rows_estimate,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 15;

-- 5. Storage: total size per bucket, and the largest files (the usual source of egress).
select bucket_id, count(*) as files, pg_size_pretty(sum(coalesce((metadata->>'size')::bigint, 0))) as total
from storage.objects group by bucket_id order by sum(coalesce((metadata->>'size')::bigint, 0)) desc;

select bucket_id, name, pg_size_pretty(coalesce((metadata->>'size')::bigint, 0)) as size, metadata->>'mimetype' as type, created_at
from storage.objects order by coalesce((metadata->>'size')::bigint, 0) desc limit 10;

-- 6. Test data still in production (see remove-test-data.sql): accounts on test domains.
select count(*) as test_accounts from auth.users where email ilike '%@forge.test' or email ilike '%@example.com';
