-- Step 33: retention cohorts and company reply rates for /admin (Linear FIX-52). The first two
-- numbers investors ask for: do members come back, and do students answer companies?
-- Aggregates only, Forge admins only. Additive and safe to re-run.
--
-- "Active" means the same as in admin_metrics(): posted, replied, messaged or added a milestone.

create or replace function public.admin_retention() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_forge_admin() then raise exception 'Forge admins only.' using errcode = '42501'; end if;
  with weeks as (
    -- The last 8 weeks that started, oldest first (weeks start on Monday, UTC).
    select generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as wk
  ),
  cohort as (
    select p.id, date_trunc('week', p.created_at) as wk from public.profiles p
    where p.created_at >= (select min(wk) from weeks)
  ),
  acted as (
    select distinct uid, date_trunc('week', at) as wk from (
      select author_id as uid, created_at as at from public.posts
      union all select author_id, created_at from public.comments
      union all select sender_id, created_at from public.messages
      union all select owner_id, created_at from public.milestones
    ) a
    where at >= (select min(wk) from weeks) and uid in (select id from cohort)
  ),
  rows as (
    select w.wk,
      (select count(*) from cohort c where c.wk = w.wk) as size,
      -- For each later week that has started: how many of this cohort were active in it.
      (select coalesce(jsonb_agg(n order by k), '[]'::jsonb) from (
         select k, (select count(distinct a.uid) from acted a join cohort c on c.id = a.uid
                    where c.wk = w.wk and a.wk = w.wk + make_interval(weeks => k)) as n
         from generate_series(1, 8) k
         where w.wk + make_interval(weeks => k) <= date_trunc('week', now())
       ) later) as active
    from weeks w
  ),
  -- Conversations a verified company or school admin started in the last 90 days, and whether the
  -- other person wrote back (and how fast).
  company as (
    select c.id, c.started_by,
      (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id = c.started_by) as first_sent,
      (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id <> c.started_by) as first_reply
    from public.conversations c
    where c.created_at > now() - interval '90 days'
      and exists (select 1 from public.organization_admins oa join public.organizations o on o.id = oa.org_id
                  where oa.uid = c.started_by and o.type in ('company', 'school') and o.verification_status = 'verified')
  )
  select jsonb_build_object(
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk, 'YYYY-MM-DD'), 'size', size, 'active', active) order by wk), '[]'::jsonb) from rows),
    'company_conversations_90d', (select count(*) from company where first_sent is not null),
    'company_replied_90d', (select count(*) from company where first_sent is not null and first_reply is not null),
    'company_median_hours_to_reply', (select round((extract(epoch from percentile_cont(0.5) within group (order by first_reply - first_sent)) / 3600)::numeric, 1)
                                      from company where first_sent is not null and first_reply > first_sent)
  ) into r;
  return r;
end $$;

revoke execute on function public.admin_retention() from anon, public;
grant execute on function public.admin_retention() to authenticated;
