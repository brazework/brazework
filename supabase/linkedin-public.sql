-- Show your LinkedIn on your profile, if you choose to. Run after club-deletion.sql. Additive: one new
-- column and new functions; nothing the live app uses changes.
--
-- linkedin-required.sql keeps every member's LinkedIn link private: the column is granted to nobody.
-- This adds a switch the member turns on themselves ("Show it on my profile", Settings, under
-- Profile). It's off for everyone, existing members included, until they do. When it's on, signed-in
-- members see a link to it on the profile page, under the record row. It still never shows on a public
-- record (/v pages) or to signed-out visitors, and the column itself stays ungranted: it's read through
-- profile_linkedin() alone.
alter table public.profiles add column if not exists linkedin_public boolean not null default false;

-- Your own switch, for the Settings form.
create or replace function public.my_linkedin_public() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select linkedin_public from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.set_linkedin_public(p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  update public.profiles set linkedin_public = coalesce(p_on, false) where id = me;
  if not found then raise exception 'Finish setting up your account first.' using errcode = 'P0001'; end if;
  return coalesce(p_on, false);
end $$;

-- A member's LinkedIn link, only when they chose to show it (and have one); null otherwise. The owner
-- gets the same answer as everyone else, so their own page shows what visitors see.
create or replace function public.profile_linkedin(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select linkedin_url from public.profiles where id = p_id and linkedin_public and linkedin_url is not null and auth.uid() is not null
$$;

create or replace function public.linkedin_public_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.my_linkedin_public(), public.set_linkedin_public(boolean), public.profile_linkedin(uuid) from public, anon;
grant execute on function public.my_linkedin_public(), public.set_linkedin_public(boolean), public.profile_linkedin(uuid), public.linkedin_public_ready() to authenticated;
