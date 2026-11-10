-- Forge admin metrics: the numbers that say whether the loop works (join a club → post what you're
-- building → club verifies it → proof on a profile → companies find you). Aggregates only, Forge
-- admins only. Run after challenges.sql. Additive.

create function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_forge_admin() then raise exception 'Forge admins only.' using errcode = '42501'; end if;
  with active as (
    select author_id as uid from public.posts where created_at > now() - interval '7 days'
    union select author_id from public.comments where created_at > now() - interval '7 days'
    union select sender_id from public.messages where created_at > now() - interval '7 days'
    union select owner_id from public.milestones where created_at > now() - interval '7 days'
  ),
  -- Time from the latest submission to verification, for milestones verified in the last 30 days.
  verify_times as (
    select v.created_at - (select max(s.created_at) from public.verification_events s
                           where s.milestone_id = v.milestone_id and s.action = 'submitted' and s.created_at <= v.created_at) as took
    from public.verification_events v
    where v.action = 'verified' and v.created_at > now() - interval '30 days'
  ),
  club_posts as (
    select c.id, c.name, count(p.id) as posts,
      (select count(*) from public.community_members m where m.community_id = c.id) as members
    from public.communities c
    left join public.posts p on p.community_id = c.id and p.created_at > now() - interval '7 days'
    group by c.id, c.name
  )
  select jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarded),
    'weekly_active', (select count(distinct uid) from active where uid is not null),
    'in_a_club', (select count(distinct uid) from public.community_members),
    'with_project', (select count(distinct owner_id) from public.projects),
    'with_verified', (select count(distinct owner_id) from public.milestones where status = 'verified'),
    'submitted_30d', (select count(*) from public.verification_events where action = 'submitted' and created_at > now() - interval '30 days'),
    'verified_30d', (select count(*) from public.verification_events where action = 'verified' and created_at > now() - interval '30 days'),
    'median_hours_to_verify', (select round((extract(epoch from percentile_cont(0.5) within group (order by took)) / 3600)::numeric, 1) from verify_times where took is not null),
    'clubs', (select count(*) from public.communities),
    'clubs_active_7d', (select count(*) from club_posts where posts > 0),
    'handoffs', (select count(*) from public.club_handoffs),
    'top_clubs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'posts', posts, 'members', members) order by posts desc, members desc), '[]') from (select * from club_posts order by posts desc, members desc limit 8) t),
    'companies', (select count(*) from public.organizations where type in ('company', 'school') and verification_status = 'verified'),
    'challenges_live', (select count(*) from public.challenges where status in ('open', 'judging')),
    'challenge_entries', (select count(*) from public.challenge_entries),
    'sponsorships_paid', (select count(*) from public.challenges where sponsorship = 'paid'),
    'sponsorships_pilot', (select count(*) from public.challenges where sponsorship = 'pilot'),
    'open_queue', (select count(*) from public.admin_queue where status = 'open')
  ) into r;
  return r;
end $$;

revoke execute on function public.admin_metrics() from anon, public;
grant execute on function public.admin_metrics() to authenticated;
