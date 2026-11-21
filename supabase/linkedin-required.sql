-- LinkedIn for working accounts (Linear FIX-214). Run after approved-by.sql. Additive: one new
-- column, new functions and one trigger; nothing the live app uses changes.
--
-- The rule: someone with a working (professional) account adds their LinkedIn profile link before
-- they ask a person to sign their work. Signing up doesn't need it (the form offers it, optional),
-- and neither does logging work or backing it with GitHub. Students are never asked.
--
-- The link is private. Profile columns are granted one by one (schema.sql), and this one is granted
-- to nobody, so no member can read another member's link and no member can write it directly: it is
-- read and set only through the functions below, for the signed-in member alone. It never shows on a
-- public record, because a LinkedIn profile names the employer. It is kept so that, once company
-- seats exist, a verified recruiter can open it as a second check of who the person is.
alter table public.profiles add column if not exists linkedin_url text;

-- One shape for every link: https://www.linkedin.com/in/<name>. People paste what the address bar
-- shows (a country subdomain, a trailing slash, tracking after a "?"), so those are accepted and
-- dropped. Anything that isn't a personal profile on linkedin.com is refused. Empty means none.
create or replace function public.linkedin_clean(p_url text) returns text
language plpgsql immutable set search_path = public as $$
declare s text := trim(coalesce(p_url, '')); m text[];
begin
  if s = '' then return null; end if;
  m := regexp_match(s, '^(?:https?://)?(?:[a-z]{1,3}\.)?linkedin\.com/in/([a-z0-9_%-]{3,100})/?(?:[?#].*)?$', 'i');
  if m is null then
    raise exception 'Enter your LinkedIn profile link, like linkedin.com/in/yourname.' using errcode = 'P0001';
  end if;
  return 'https://www.linkedin.com/in/' || m[1];
end $$;

-- True while the signed-in member is a professional with no link: they can't ask for a signature
-- yet. The app reads this to offer the field where they ask.
create or replace function public.needs_linkedin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and account_type = 'professional' and linkedin_url is null)
$$;

-- The signed-in member's own link (for Settings). Nobody else's.
create or replace function public.my_linkedin() returns text
language sql stable security definer set search_path = public as $$
  select linkedin_url from public.profiles where id = auth.uid()
$$;

-- Set or change your own link. Once you have asked someone to sign your work, a working account
-- keeps a link: it can be changed, not removed.
create or replace function public.set_linkedin(p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); clean text; kind text;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  clean := public.linkedin_clean(p_url);
  select account_type into kind from public.profiles where id = me;
  if not found then raise exception 'Finish setting up your account first.' using errcode = 'P0001'; end if;
  if clean is null and kind = 'professional'
     and exists (select 1 from public.milestone_vouches where requested_by = me and state in ('asked', 'vouched')) then
    raise exception 'You''ve asked people to sign your work, so your account keeps a LinkedIn link. You can change it.' using errcode = 'P0001';
  end if;
  update public.profiles set linkedin_url = clean where id = me;
  return clean;
end $$;

-- "About you" with the link, which is optional there. The four-argument finish_signup()
-- (oauth-signup.sql) keeps every rule it has; this checks the link first, so a link that isn't a
-- LinkedIn profile stops the sign-up before any profile is made.
create or replace function public.finish_signup(p_account_type text, p_first_name text, p_last_name text, p_birthday text, p_linkedin text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); clean text;
begin
  if me is null then raise exception 'Log in first.' using errcode = '42501'; end if;
  clean := public.linkedin_clean(p_linkedin);
  perform public.finish_signup(p_account_type, p_first_name, p_last_name, p_birthday);
  if clean is not null then update public.profiles set linkedin_url = clean where id = me; end if;
end $$;

-- The rule itself, where every ask is made: request_vouch() (the app, Ember's cards) and
-- mcp_request_vouch() (connected AI tools) both end in an insert here, so none can skip it.
create or replace function public.vouch_needs_linkedin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = new.requested_by and account_type = 'professional' and linkedin_url is null) then
    raise exception 'Add your LinkedIn profile link before you ask someone to sign. It''s in Settings, under Profile.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists vouch_needs_linkedin on public.milestone_vouches;
create trigger vouch_needs_linkedin before insert on public.milestone_vouches
  for each row execute function public.vouch_needs_linkedin();
revoke execute on function public.vouch_needs_linkedin() from public, anon, authenticated;

create or replace function public.linkedin_required_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.needs_linkedin(), public.my_linkedin(), public.set_linkedin(text),
  public.finish_signup(text, text, text, text, text), public.linkedin_clean(text) from public, anon;
grant execute on function public.needs_linkedin(), public.my_linkedin(), public.set_linkedin(text),
  public.finish_signup(text, text, text, text, text), public.linkedin_clean(text), public.linkedin_required_ready() to authenticated;
