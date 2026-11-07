-- Forge organizations and events. Run after schema.sql (paste into the SQL editor and click Run).
-- Companies and schools register with a signed-in account whose confirmed email matches their website's
-- domain, and post events into the Events tab. Forge posts its own events through the "Forge" organization.
-- Events leave the Events tab 24 hours after they end. The row stays, so the organization keeps a log.

create table public.organizations (
  id text primary key default gen_random_uuid()::text,
  type text not null check (type in ('company', 'school', 'forge')),
  name text not null check (char_length(name) between 2 and 120),
  domain text unique,
  location text not null default '' check (char_length(location) <= 160),
  size text not null default '',
  industries text[] not null default '{}' check (cardinality(industries) <= 14),
  verification_status text not null default 'verified' check (verification_status in ('verified', 'suspended')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.organization_admins (
  org_id text not null references public.organizations (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, uid)
);
create index organization_admins_uid_idx on public.organization_admins (uid);

create table public.events (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  type text not null check (type in ('Career fair', 'Networking', 'Workshop', 'Talk', 'Hackathon', 'Conference')),
  format text not null check (format in ('Online', 'In person', 'Hybrid')),
  location text not null default '' check (char_length(location) <= 160),
  link text not null default '' check (link = '' or (char_length(link) <= 300 and link ~ '^https?://')),
  topic text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'published' check (status in ('published', 'cancelled')),
  rsvp_count integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index events_ends_idx on public.events (ends_at);
create index events_org_idx on public.events (org_id, starts_at desc);

create table public.event_rsvps (
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_idx on public.event_rsvps (user_id);

-- Saved events are private, and separate from saved posts.
create table public.event_saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  event_id text not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create function public.is_org_admin(p_org text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_admins where org_id = p_org and uid = auth.uid())
$$;

-- Registers a company or school. Your confirmed account email has to be at the website's domain,
-- and personal email providers are rejected. You become its first admin.
create function public.create_organization(p_type text, p_name text, p_website text, p_location text,
                                           p_size text, p_industries text[])
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_email text; v_host text; v_domain text; v_org text;
begin
  select lower(email) into v_email from auth.users where id = me and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your email first.' using errcode = '42501'; end if;
  if p_type not in ('company', 'school') then raise exception 'Choose company or school.' using errcode = 'P0001'; end if;
  v_host := split_part(v_email, '@', 2);
  if v_host = any (array['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com']) then
    raise exception 'Organizations are verified through a work email. Log in with an account at your organization''s email address.' using errcode = 'P0001';
  end if;
  v_domain := split_part(regexp_replace(regexp_replace(lower(trim(coalesce(p_website, ''))), '^https?://', ''), '^www\.', ''), '/', 1);
  if v_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then raise exception 'Enter your organization''s website.' using errcode = 'P0001'; end if;
  if not (v_host = v_domain or right(v_host, char_length(v_domain) + 1) = '.' || v_domain) then
    raise exception 'Your account email (at %) has to match the website''s domain (%), so we can confirm you work there.', v_host, v_domain using errcode = 'P0001';
  end if;
  if p_type = 'school' and v_domain !~ '(^|\.)[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$' then
    raise exception 'School websites need an academic domain (for example, ending in .edu or .ac.uk).' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organizations where domain = v_domain) then
    raise exception 'An organization at % is already registered. Ask its admin about adding you.', v_domain using errcode = 'P0001';
  end if;
  insert into public.organizations (type, name, domain, location, size, industries, created_by)
  values (p_type, trim(p_name), v_domain, coalesce(trim(p_location), ''), coalesce(p_size, ''), coalesce(p_industries, '{}'), me)
  returning id into v_org;
  insert into public.organization_admins (org_id, uid) values (v_org, me);
  return v_org;
end $$;

-- The attending count moves by one with each RSVP.
create function public.event_rsvps_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.events set rsvp_count = rsvp_count + 1 where id = new.event_id;
  else
    update public.events set rsvp_count = greatest(rsvp_count - 1, 0) where id = old.event_id;
  end if;
  return null;
end $$;
create trigger event_rsvps_count after insert or delete on public.event_rsvps
  for each row execute function public.event_rsvps_count();

-- ---------- Who can do what ----------

-- Supabase grants full table permissions on new tables by default; start from none.
revoke all on public.organizations, public.organization_admins, public.events, public.event_rsvps, public.event_saves from anon, authenticated;

alter table public.organizations enable row level security;
alter table public.organization_admins enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_saves enable row level security;

-- Organizations change only through create_organization (and by Forge, in the dashboard).
grant select on public.organizations to authenticated;
create policy "read organizations" on public.organizations for select to authenticated
  using (verification_status = 'verified' or public.is_org_admin(id));

grant select on public.organization_admins to authenticated;
create policy "your organization roles" on public.organization_admins for select to authenticated
  using (uid = auth.uid());

-- Members see published events from verified organizations until 24 hours after they end.
-- The hosting organization's admins always see their own, which is what makes the past-events log.
grant select on public.events to authenticated;
grant insert (org_id, title, description, type, format, location, link, topic, starts_at, ends_at) on public.events to authenticated;
grant update (title, description, type, format, location, link, topic, starts_at, ends_at, status) on public.events to authenticated;
create policy "read events" on public.events for select to authenticated
  using ((status = 'published' and ends_at > now() - interval '24 hours'
          and exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'verified'))
    or public.is_org_admin(org_id));
create policy "organizations add events" on public.events for insert to authenticated
  with check (public.is_org_admin(org_id) and ends_at > now()
    and exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'verified'));
-- Once an event is over it can't be changed, so the log stays accurate.
create policy "organizations edit upcoming events" on public.events for update to authenticated
  using (public.is_org_admin(org_id) and ends_at > now())
  with check (public.is_org_admin(org_id));

-- You can see your own RSVPs and your connections', for "2 connections going".
grant select, delete on public.event_rsvps to authenticated;
grant insert (event_id) on public.event_rsvps to authenticated;
create policy "read your and your connections' RSVPs" on public.event_rsvps for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.connections c where c.status = 'accepted'
    and ((c.from_id = auth.uid() and c.to_id = user_id) or (c.to_id = auth.uid() and c.from_id = user_id))));
create policy "RSVP to events that aren't over" on public.event_rsvps for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.events e
    where e.id = event_id and e.status = 'published' and e.ends_at > now()));
create policy "cancel your RSVP" on public.event_rsvps for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.event_saves to authenticated;
grant insert (event_id) on public.event_saves to authenticated;
create policy "your saved events" on public.event_saves for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id));

revoke execute on function public.event_rsvps_count() from anon, authenticated, public;
revoke execute on function public.create_organization(text, text, text, text, text, text[]), public.is_org_admin(text) from anon, public;
grant execute on function public.create_organization(text, text, text, text, text, text[]), public.is_org_admin(text) to authenticated;

alter publication supabase_realtime add table public.events;

-- Forge's own events are posted through this organization. Add its admins in the dashboard
-- (Table Editor > organization_admins).
insert into public.organizations (type, name) values ('forge', 'Forge');

-- Tables created from now on start with no permissions for the site's roles.
alter default privileges in schema public revoke all on tables from anon, authenticated;
