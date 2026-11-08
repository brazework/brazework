-- Club events: communities can host events, not just verified organizations.
-- Run after events.sql (and tours.sql). Additive: existing organization events are untouched.
--
-- Every event has exactly one host: an organization OR a community.
-- Community admins and owners (rank 4+) host; who can see a community's events follows the
-- community itself (can_view: public communities for everyone, approval-required for members).
-- RSVPs, saves, the 24-hour cutoff and "ended events can't be edited" work exactly as before.

alter table public.events alter column org_id drop not null;
alter table public.events add column community_id text references public.communities (id) on delete cascade;
alter table public.events add constraint events_one_host check ((org_id is null) <> (community_id is null));
create index events_community_idx on public.events (community_id, starts_at desc) where community_id is not null;

-- Admins and owners of a community run its events.
create function public.can_host_community_events(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and public.my_rank(cid) >= 4
$$;
revoke execute on function public.can_host_community_events(text) from anon, public;
grant execute on function public.can_host_community_events(text) to authenticated;

grant insert (community_id) on public.events to authenticated;

drop policy "read events" on public.events;
create policy "read events" on public.events for select to authenticated
  using ((status = 'published' and ends_at > now() - interval '24 hours'
          and ((org_id is not null and exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'verified'))
            or (community_id is not null and public.can_view(community_id))))
    or public.is_org_admin(org_id)
    or public.can_host_community_events(community_id));

drop policy "organizations add events" on public.events;
create policy "hosts add events" on public.events for insert to authenticated
  with check (ends_at > now() and (
    (org_id is not null and community_id is null and public.is_org_admin(org_id)
      and exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'verified'))
    or (community_id is not null and org_id is null and public.can_host_community_events(community_id))));

-- Once an event is over it can't be changed, so the log stays accurate. The host can't be switched.
drop policy "organizations edit upcoming events" on public.events;
create policy "hosts edit upcoming events" on public.events for update to authenticated
  using ((public.is_org_admin(org_id) or public.can_host_community_events(community_id)) and ends_at > now())
  with check (public.is_org_admin(org_id) or public.can_host_community_events(community_id));
