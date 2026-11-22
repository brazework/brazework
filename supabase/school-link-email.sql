-- Step 89: a club's link to its university is asked for from a confirmed university email (Linear
-- FIX-237). Builds on step 56 (school-links.sql): a club asks to be listed under its school, and the
-- school's official admins (or Brazework admins, until the school is set up) decide; verified clubs
-- show a "Verified club of <school>" badge.
--
-- What changes:
--   - Asking needs an officer whose confirmed sign-in email is at the school's domain (or a subdomain,
--     like eng.hartford.edu). Student accounts already sign up with their university email
--     (oauth-signup.sql), so most officers have one; anyone else changes their email in Settings
--     (Supabase confirms the new address) or asks another officer who has one. A club's moderators can
--     ask too, not just its owner and admins, so the officer with the school address can send it.
--   - The request keeps the confirmed address it came from (requester_email).
--   - The reviewer sees which officers stand behind it: school_link_backers() lists the club's
--     officers whose confirmed email is at that school, for the school's official admins and
--     Brazework admins only.
-- Additive and safe to re-run.

alter table public.club_school_links add column if not exists requester_email text
  check (requester_email is null or char_length(requester_email) <= 320);

-- Is this address at the school's domain, or one of its subdomains?
create or replace function public.email_at_domain(p_email text, p_domain text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_email, '') <> '' and coalesce(p_domain, '') <> ''
     and (split_part(lower(p_email), '@', 2) = lower(p_domain)
          or right(split_part(lower(p_email), '@', 2), char_length(p_domain) + 1) = '.' || lower(p_domain))
$$;

create or replace function public.request_school_link(p_cid text, p_school text, p_website text, p_evidence text) returns void
language plpgsql security definer set search_path = public as $$
declare v_domain text; v_email text;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if public.my_rank(p_cid) < 3 then raise exception 'Only the club''s officers can do this.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_school, ''))) not between 2 and 120 then raise exception 'Enter the school''s name.' using errcode = 'P0001'; end if;
  v_domain := split_part(regexp_replace(regexp_replace(lower(btrim(coalesce(p_website, ''))), '^https?://', ''), '^www\.', ''), '/', 1);
  if v_domain !~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$' then
    raise exception 'Enter the school''s website, with an academic domain (for example hartford.edu).' using errcode = 'P0001';
  end if;
  if coalesce(p_evidence, '') !~* '^https://\S+$' or char_length(p_evidence) > 300 then
    raise exception 'Add a link that shows the club is part of the school, such as its page in the school''s student-organization directory.' using errcode = 'P0001';
  end if;
  -- The school needs to know the people asking are its students: a confirmed address at its domain.
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if not public.email_at_domain(v_email, v_domain) then
    raise exception 'Ask from your @% email so the school knows you''re a student there. Change your email in Settings, or ask another officer who has one.', v_domain using errcode = 'P0001';
  end if;
  insert into public.club_school_links (community_id, school_name, school_domain, evidence_url, status, requester_at_school, requester_email, requested_by, requested_at, decided_by, decided_at, decision_note)
  values (p_cid, btrim(p_school), v_domain, btrim(p_evidence), 'pending', true, v_email, auth.uid(), now(), null, null, '')
  on conflict (community_id) do update set school_name = excluded.school_name, school_domain = excluded.school_domain,
    evidence_url = excluded.evidence_url, status = 'pending', requester_at_school = true, requester_email = excluded.requester_email,
    requested_by = excluded.requested_by, requested_at = now(), decided_by = null, decided_at = null, decision_note = '';
end $$;

-- The club's officers whose confirmed email is at the school, for whoever reviews the request.
create or replace function public.school_link_backers(p_cid text) returns table (uid uuid, first_name text, last_name text, role text, email text)
language plpgsql stable security definer set search_path = public as $$
declare l public.club_school_links;
begin
  select * into l from public.club_school_links where community_id = p_cid;
  if l.community_id is null then return; end if;
  if not (public.is_forge_admin() or public.speaks_for_school(l.school_domain)) then
    raise exception 'Only the school or a Brazework admin can see this.' using errcode = '42501';
  end if;
  return query
    select m.uid, p.first_name, p.last_name, m.role, lower(u.email)::text
      from public.community_members m
      join public.profiles p on p.id = m.uid
      join auth.users u on u.id = m.uid and u.email_confirmed_at is not null
     where m.community_id = p_cid and m.role in ('owner', 'admin', 'moderator')
       and public.email_at_domain(u.email, l.school_domain)
     order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.first_name;
end $$;

revoke execute on function public.school_link_backers(text), public.email_at_domain(text, text) from anon, public;
grant execute on function public.school_link_backers(text), public.email_at_domain(text, text) to authenticated;

create or replace function public.school_link_email_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
