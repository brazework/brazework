-- The weekly build loop (Linear FIX-67): who looked at your profile.
-- Profile views are recorded by record_profile_view() (activity.sql) and stay unreadable row by row.
-- This returns, for the signed-in member only, the verified companies whose admins looked (by name:
-- they're recruiting, and being seen by them is the payoff) and how many people looked in all.
-- Individual members who looked are never named, only counted. Additive; safe to run again.

create or replace function public.my_viewers(p_days integer default 7) returns jsonb
language sql stable security definer set search_path = public as $$
  with v as (
    select viewer, max(viewed_at) as at
      from public.profile_views
     where profile_id = auth.uid()
       and viewed_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
     group by viewer
  ), co as (
    select o.name, max(v.at) as at
      from v
      join public.organization_admins a on a.uid = v.viewer
      join public.organizations o on o.id = a.org_id and o.type = 'company' and o.verification_status = 'verified'
     group by o.name
  )
  select jsonb_build_object(
    'total', (select count(*) from v),
    'companies', coalesce((select jsonb_agg(c.name order by c.at desc) from (select name, at from co order by at desc limit 5) c), '[]'::jsonb)
  )
$$;
revoke execute on function public.my_viewers(integer) from public, anon;
grant execute on function public.my_viewers(integer) to authenticated;

-- Lets the app check this step has run (lib/db-features.ts), like the other *_ready() probes.
create or replace function public.weekly_loop_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.weekly_loop_ready() to anon, authenticated;
