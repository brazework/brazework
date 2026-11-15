-- Step 56: clubs verified as operating under a school. A club's owner or an admin asks to be listed
-- under its school (name, academic website, and evidence such as the club's listing in the school's
-- student-organization directory). The request is decided by:
--   - the school itself, once it has an official school account on Brazework (an organization of type
--     'school' with that domain that a Brazework admin has marked official), or
--   - until then, Brazework admins (forge_admins), on /admin.
-- Verified clubs get a "Verified club of <school>" badge, and school_clubs() lists a school's verified
-- clubs for the school's page. One school per club; asking again (or for another school) starts a new
-- request. The club's owner is notified of the decision. Additive and safe to re-run.

-- ---------- Official school accounts ----------
-- Schools don't sign themselves up: they get in touch, and a Brazework admin sets up the official
-- account with set_up_school() below (self-serve create_organization() is for companies only now).
-- Any school organizations registered before this step stay unofficial; members can't set official.
alter table public.organizations add column if not exists official boolean not null default false;

-- Whether you speak for the school at this domain: an admin of its official school account.
create or replace function public.speaks_for_school(p_domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o join public.organization_admins a on a.org_id = o.id
     where o.type = 'school' and o.official and o.verification_status = 'verified'
       and o.domain = lower(p_domain) and a.uid = auth.uid())
$$;
revoke execute on function public.speaks_for_school(text) from anon, public;
grant execute on function public.speaks_for_school(text) to authenticated;

-- ---------- Club ↔ school links ----------
create table if not exists public.club_school_links (
  community_id text primary key references public.communities (id) on delete cascade,
  school_name text not null check (char_length(btrim(school_name)) between 2 and 120),
  school_domain text not null check (school_domain ~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$'),
  evidence_url text not null check (char_length(evidence_url) <= 300 and evidence_url ~* '^https://\S+$'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'declined')),
  -- Whether the person asking signed in with an address at that school (a signal for the reviewer).
  requester_at_school boolean not null default false,
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 300)
);
create index if not exists club_school_links_domain_idx on public.club_school_links (school_domain, status);
create index if not exists club_school_links_requested_by_fk_idx on public.club_school_links (requested_by);
create index if not exists club_school_links_decided_by_fk_idx on public.club_school_links (decided_by);

alter table public.club_school_links enable row level security;
revoke all on public.club_school_links from anon, authenticated;
grant select on public.club_school_links to authenticated;
-- Verified links are public (the badge); a pending or declined one is seen by the club's officers,
-- the school's official admins and Brazework admins. Changes go through the functions below.
drop policy if exists "verified links, or the ones you handle" on public.club_school_links;
create policy "verified links, or the ones you handle" on public.club_school_links for select to authenticated
  using (status = 'verified' or public.my_rank(community_id) >= 3 or public.is_forge_admin() or public.speaks_for_school(school_domain));

-- Ask to be listed under a school (club owners and admins). Replaces any earlier link or request.
create or replace function public.request_school_link(p_cid text, p_school text, p_website text, p_evidence text) returns void
language plpgsql security definer set search_path = public as $$
declare v_domain text; v_email text; v_host text;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if public.my_rank(p_cid) < 4 then raise exception 'Only the club''s owner or an admin can do this.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_school, ''))) not between 2 and 120 then raise exception 'Enter the school''s name.' using errcode = 'P0001'; end if;
  v_domain := split_part(regexp_replace(regexp_replace(lower(btrim(coalesce(p_website, ''))), '^https?://', ''), '^www\.', ''), '/', 1);
  if v_domain !~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$' then
    raise exception 'Enter the school''s website, with an academic domain (for example hartford.edu).' using errcode = 'P0001';
  end if;
  if coalesce(p_evidence, '') !~* '^https://\S+$' or char_length(p_evidence) > 300 then
    raise exception 'Add a link that shows the club is part of the school, such as its page in the school''s student-organization directory.' using errcode = 'P0001';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  v_host := split_part(coalesce(v_email, ''), '@', 2);
  insert into public.club_school_links (community_id, school_name, school_domain, evidence_url, status, requester_at_school, requested_by, requested_at, decided_by, decided_at, decision_note)
  values (p_cid, btrim(p_school), v_domain, btrim(p_evidence), 'pending',
          v_host = v_domain or right(v_host, char_length(v_domain) + 1) = '.' || v_domain, auth.uid(), now(), null, null, '')
  on conflict (community_id) do update set school_name = excluded.school_name, school_domain = excluded.school_domain,
    evidence_url = excluded.evidence_url, status = 'pending', requester_at_school = excluded.requester_at_school,
    requested_by = excluded.requested_by, requested_at = now(), decided_by = null, decided_at = null, decision_note = '';
end $$;

-- Approve or decline (the school's official admins, or Brazework admins). The club's owner hears.
create or replace function public.decide_school_link(p_cid text, p_approve boolean, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare l public.club_school_links; c public.communities;
begin
  select * into l from public.club_school_links where community_id = p_cid for update;
  if l.community_id is null or l.status <> 'pending' then raise exception 'There''s no request waiting for this club.' using errcode = 'P0001'; end if;
  if not (public.is_forge_admin() or public.speaks_for_school(l.school_domain)) then
    raise exception 'Only the school or a Brazework admin can decide this.' using errcode = '42501';
  end if;
  update public.club_school_links set status = case when p_approve then 'verified' else 'declined' end,
    decided_by = auth.uid(), decided_at = now(), decision_note = left(btrim(coalesce(p_note, '')), 300)
   where community_id = p_cid;
  select * into c from public.communities where id = p_cid;
  perform public.notify(c.owner_id, auth.uid(), 'community_approved', null, null, p_cid,
    case when p_approve then c.name || ' is now a verified club of ' || l.school_name
         else c.name || ' wasn''t verified as a club of ' || l.school_name
              || case when btrim(coalesce(p_note, '')) <> '' then ': ' || left(btrim(p_note), 200) else '.' end end);
end $$;

-- Stop being listed under the school, or take back a request (club owners and admins).
create or replace function public.remove_school_link(p_cid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_rank(p_cid) < 4 then raise exception 'Only the club''s owner or an admin can do this.' using errcode = '42501'; end if;
  delete from public.club_school_links where community_id = p_cid;
end $$;

-- A school's verified clubs, for its page: each club you can see, biggest first.
create or replace function public.school_clubs(p_domain text) returns table (id text, name text, member_count integer, school_name text, verified_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.member_count, l.school_name, l.decided_at
    from public.club_school_links l join public.communities c on c.id = l.community_id
   where l.school_domain = lower(p_domain) and l.status = 'verified'
   order by c.member_count desc, c.name
$$;

revoke execute on function public.request_school_link(text, text, text, text), public.decide_school_link(text, boolean, text),
  public.remove_school_link(text), public.school_clubs(text) from anon, public;
grant execute on function public.request_school_link(text, text, text, text), public.decide_school_link(text, boolean, text),
  public.remove_school_link(text), public.school_clubs(text) to authenticated;

-- ---------- Schools are set up by Brazework, not self-serve ----------
-- A school gets in touch with the Brazework team, and a Brazework admin sets up its official account
-- and names its admins (by the email they sign in with). Self-serve registration is for companies
-- only: create_organization() is otherwise exactly as before (events.sql), minus 'school'.
create or replace function public.create_organization(p_type text, p_name text, p_website text, p_location text, p_size text, p_industries text[])
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_email text; v_host text; v_domain text; v_org text;
begin
  select lower(email) into v_email from auth.users where id = me and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your email first.' using errcode = '42501'; end if;
  if p_type = 'school' then
    raise exception 'School accounts are set up with the Brazework team. Get in touch and we''ll set up your school''s official account.' using errcode = 'P0001';
  end if;
  if p_type <> 'company' then raise exception 'Choose company.' using errcode = 'P0001'; end if;
  v_host := split_part(v_email, '@', 2);
  if v_host = any (array['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com']) then
    raise exception 'Organizations are verified through a work email. Log in with an account at your organization''s email address.' using errcode = 'P0001';
  end if;
  v_domain := split_part(regexp_replace(regexp_replace(lower(trim(coalesce(p_website, ''))), '^https?://', ''), '^www\.', ''), '/', 1);
  if v_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then raise exception 'Enter your organization''s website.' using errcode = 'P0001'; end if;
  if not (v_host = v_domain or right(v_host, char_length(v_domain) + 1) = '.' || v_domain) then
    raise exception 'Your account email (at %) has to match the website''s domain (%), so we can confirm you work there.', v_host, v_domain using errcode = 'P0001';
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

-- Brazework admins only: set up a school's official account, or add an admin to it. The admin must
-- already have a Brazework account with that email. Returns the school's organization id.
--   select public.set_up_school('University of Hartford', 'hartford.edu', 'dean.of.students@hartford.edu');
create or replace function public.set_up_school(p_name text, p_domain text, p_admin_email text) returns text
language plpgsql security definer set search_path = public as $$
declare v_domain text := lower(btrim(coalesce(p_domain, ''))); v_org text; v_uid uuid;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  if v_domain !~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$' then raise exception 'Use the school''s academic domain, like hartford.edu.' using errcode = 'P0001'; end if;
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_admin_email));
  if v_uid is null then raise exception 'No Brazework account uses %. Ask them to sign up first.', p_admin_email using errcode = 'P0001'; end if;
  select id into v_org from public.organizations where domain = v_domain;
  if v_org is null then
    insert into public.organizations (type, name, domain, official, created_by) values ('school', btrim(p_name), v_domain, true, auth.uid()) returning id into v_org;
  else
    -- An existing self-registered school account at that domain becomes the official one.
    update public.organizations set type = 'school', official = true, verification_status = 'verified', name = coalesce(nullif(btrim(p_name), ''), name) where id = v_org;
  end if;
  insert into public.organization_admins (org_id, uid) values (v_org, v_uid) on conflict do nothing;
  return v_org;
end $$;
revoke execute on function public.set_up_school(text, text, text) from anon, public;
grant execute on function public.set_up_school(text, text, text) to authenticated;

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.school_links_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.school_links_ready() to authenticated;
