-- Step 92: the launch numbers on the admin page (Josh, 22 Nov, after launch). The four that say whether
-- Brazework works, aggregates only, Brazework admins only:
--
-- 1. Signed results per week: milestones signed (by a club officer or a person asked by email), by the
--    week they were signed, for the last 8 weeks. A result signed and later revoked isn't counted.
-- 2. Ask to signature: of the results asked about between 30 days and 48 hours ago, how many were signed
--    within 48 hours of the first ask, and the median hours from ask to signature. The first ask is the
--    earliest of a club submission (verification_events) and an email ask (milestone_vouches).
-- 3. A second result: of the members whose first result (anything but a draft) was logged between 120
--    and 30 days ago, how many logged a second within 30 days of the first.
-- 4. Companies that found someone and wrote: verified companies whose admins, in the last 90 days, looked
--    at a member's profile, started a conversation with a member, and did both. Searches themselves
--    aren't recorded, so "looked at a profile" stands in for "found someone".
--
-- Read-only. Additive and safe to re-run.

create or replace function public.admin_launch_metrics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  with weeks as (
    select generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as wk
  ),
  signed as (
    select reviewed_at from public.milestones
    where status = 'verified' and reviewed_at >= date_trunc('week', now()) - interval '7 weeks'
  ),
  asks as (
    select m.id, m.status, m.reviewed_at,
      least(
        (select min(e.created_at) from public.verification_events e where e.milestone_id = m.id and e.action = 'submitted'),
        (select min(v.created_at) from public.milestone_vouches v where v.milestone_id = m.id)
      ) as asked_at
    from public.milestones m
    where m.status <> 'draft'
  ),
  asked as (
    select * from asks where asked_at between now() - interval '30 days' and now() - interval '48 hours'
  ),
  entries as (
    select owner_id, created_at, row_number() over (partition by owner_id order by created_at) as n
    from public.milestones where status <> 'draft'
  ),
  firsts as (
    select e1.owner_id, e1.created_at as first_at,
      exists (select 1 from entries e2 where e2.owner_id = e1.owner_id and e2.n = 2 and e2.created_at <= e1.created_at + interval '30 days') as second
    from entries e1
    where e1.n = 1 and e1.created_at between now() - interval '120 days' and now() - interval '30 days'
  ),
  companies as (
    select o.id,
      exists (select 1 from public.organization_admins oa join public.profile_views pv on pv.viewer = oa.uid
              where oa.org_id = o.id and pv.viewed_at > now() - interval '90 days') as looked,
      exists (select 1 from public.organization_admins oa join public.conversations c on c.started_by = oa.uid
              where oa.org_id = o.id and c.created_at > now() - interval '90 days'
                and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = oa.uid)) as wrote
    from public.organizations o
    where o.type = 'company' and o.verification_status = 'verified'
  )
  select jsonb_build_object(
    'signed_weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(w.wk, 'YYYY-MM-DD'),
                       'signed', (select count(*) from signed s where s.reviewed_at >= w.wk and s.reviewed_at < w.wk + interval '1 week')) order by w.wk), '[]'::jsonb) from weeks w),
    'asked', (select count(*) from asked),
    'signed_48h', (select count(*) from asked where status = 'verified' and reviewed_at <= asked_at + interval '48 hours'),
    'median_hours_ask_to_sign', (select round((extract(epoch from percentile_cont(0.5) within group (order by reviewed_at - asked_at)) / 3600)::numeric, 1)
                                 from asked where status = 'verified' and reviewed_at >= asked_at),
    'first_results', (select count(*) from firsts),
    'second_within_30d', (select count(*) from firsts where second),
    'companies_verified', (select count(*) from companies),
    'companies_looked', (select count(*) from companies where looked),
    'companies_wrote', (select count(*) from companies where wrote),
    'companies_looked_and_wrote', (select count(*) from companies where looked and wrote)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_launch_metrics() from anon, public;
grant execute on function public.admin_launch_metrics() to authenticated;

-- So the health check (and the app) can tell this step has run.
create or replace function public.launch_metrics_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.launch_metrics_ready() to anon, authenticated;
