-- Live traction for the landing page: four counts anyone can read (no rows, no names). The landing
-- hides any that are zero. Run after club-handoff.sql. Additive.
create function public.public_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clubs', (select count(*) from public.communities),
    'verified_members', (select count(distinct owner_id) from public.milestones where status = 'verified'),
    'verified_milestones', (select count(*) from public.milestones where status = 'verified'),
    'companies', (select count(*) from public.organizations where verification_status = 'verified')
  )
$$;
revoke execute on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;
