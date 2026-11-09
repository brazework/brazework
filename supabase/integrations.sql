-- Club integrations: connect a club to the tools it already uses. First: Discord.
-- A club's admins paste a Discord webhook; Forge then announces new club events, verified
-- milestones and weekly updates in the club's server. Run after milestones.sql. Additive only.
--
-- The webhook URL is a secret (anyone holding it can post to that channel), so it's readable only
-- by the club's moderators and up (they trigger milestone announcements) and set only by admins+.

create table public.club_integrations (
  community_id text primary key references public.communities (id) on delete cascade,
  discord_webhook text not null default '' check (
    discord_webhook = '' or discord_webhook ~ '^https://(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)/api/webhooks/[0-9]{5,25}/[A-Za-z0-9_-]{20,100}$'),
  discord_events boolean not null default true,
  discord_milestones boolean not null default true,
  discord_updates boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.club_integrations enable row level security;

create policy "officers read integrations" on public.club_integrations for select to authenticated
  using (public.my_rank(community_id) >= 3);
create policy "admins add integrations" on public.club_integrations for insert to authenticated
  with check (public.my_rank(community_id) >= 4);
create policy "admins change integrations" on public.club_integrations for update to authenticated
  using (public.my_rank(community_id) >= 4) with check (public.my_rank(community_id) >= 4);
create policy "admins remove integrations" on public.club_integrations for delete to authenticated
  using (public.my_rank(community_id) >= 4);

revoke all on table public.club_integrations from anon;
grant select, insert, update, delete on public.club_integrations to authenticated;

-- Who changed it and when, stamped by the database.
create function public.club_integrations_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
create trigger club_integrations_stamp before insert or update on public.club_integrations
  for each row execute function public.club_integrations_stamp();
revoke execute on function public.club_integrations_stamp() from anon, authenticated, public;
