-- Who looked, as a moment (Linear FIX-67): when a verified company looks at your profile, you get a
-- notification naming the company ("Acme Aerospace looked at your profile"), at most once a week per
-- company. The person who looked is never named or linked: the notification has no actor, only the
-- company's name. Members who look are still only counted (weekly-loop.sql).
--
-- Also fixes the weekly digest's "who looked" line, which was always empty: the digest runs with the
-- service key, where auth.uid() is null, so my_viewers() found nobody. viewers_for(member) is the same
-- query for a given member, callable only with the service key; my_viewers() now calls it for you.
-- Run after email-alerts.sql. Additive; safe to run again.

-- ---------- The new kind (this list is mentions.sql's, the latest, plus company_view) ----------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'like', 'comment', 'follow', 'connect_request', 'connect_accepted', 'community_request', 'community_approved',
  'milestone_request', 'milestone_verified', 'milestone_declined', 'mention', 'company_view'));

-- ---------- Who looked at a given member: for the digest (service key only) ----------
create or replace function public.viewers_for(p_user uuid, p_days integer default 7) returns jsonb
language sql stable security definer set search_path = public as $$
  with v as (
    select viewer, max(viewed_at) as at
      from public.profile_views
     where profile_id = p_user
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
revoke execute on function public.viewers_for(uuid, integer) from public, anon, authenticated;
grant execute on function public.viewers_for(uuid, integer) to service_role;

-- Yours, signed in: the same answer as before.
create or replace function public.my_viewers(p_days integer default 7) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then jsonb_build_object('total', 0, 'companies', '[]'::jsonb)
              else public.viewers_for(auth.uid(), p_days) end
$$;
revoke execute on function public.my_viewers(integer) from public, anon;
grant execute on function public.my_viewers(integer) to authenticated;

-- ---------- Recording a view, and telling the member when it's a verified company ----------
create or replace function public.record_profile_view(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  org record;
begin
  if me is null or me = p_profile then return; end if;
  if not exists (select 1 from auth.users where id = me and email_confirmed_at is not null) then return; end if;
  if not exists (select 1 from public.profiles where id = p_profile) then return; end if;
  insert into public.profile_views (profile_id, viewer) values (p_profile, me) on conflict do nothing;
  -- The payoff for showing your work: a recruiter looked. Named by company, never by person.
  for org in
    select o.name from public.organization_admins a
      join public.organizations o on o.id = a.org_id and o.type = 'company' and o.verification_status = 'verified'
     where a.uid = me
  loop
    if not exists (select 1 from public.notifications
                    where user_id = p_profile and kind = 'company_view' and community_name = org.name
                      and created_at > now() - interval '7 days') then
      insert into public.notifications (user_id, kind, community_name) values (p_profile, 'company_view', org.name);
    end if;
  end loop;
end $$;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.who_looked_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.who_looked_ready() to authenticated;
