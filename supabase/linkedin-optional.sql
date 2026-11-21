-- Step 87: the LinkedIn link is optional (founders, 2026-11-21, before the Product Hunt launch).
-- Run after personal-email-signers.sql. Safe to re-run.
--
-- linkedin-required.sql (step 85, Linear FIX-214) made a working account add its LinkedIn profile link
-- before asking a person to sign. Nothing reads the link yet (recruiter accounts don't exist), anyone
-- can paste any profile, and it stopped every working member at the moment they ask for their first
-- signature. What makes a signature believable is the signer: they sign from their own inbox, the
-- record says what kind of address it was, and nobody signs their own work. So the link stays, private
-- and optional, and asking never waits for it.
--
-- What changes:
--   - The rule on milestone_vouches goes: an ask is never refused for a missing link.
--   - needs_linkedin() answers false for everyone. The app asks it before offering the field where you
--     ask; the app that is live during the deploy keeps working, and simply stops asking.
--   - set_linkedin() lets anyone remove their link, including after they've asked someone to sign.
-- What stays: the column, its privacy (granted to nobody), linkedin_clean(), my_linkedin(), the
-- optional field at sign-up and in Settings, and "Download your data".
drop trigger if exists vouch_needs_linkedin on public.milestone_vouches;

create or replace function public.needs_linkedin() returns boolean
language sql stable security definer set search_path = public as $$ select false $$;

create or replace function public.set_linkedin(p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); clean text;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  clean := public.linkedin_clean(p_url);
  if not exists (select 1 from public.profiles where id = me) then
    raise exception 'Finish setting up your account first.' using errcode = 'P0001';
  end if;
  update public.profiles set linkedin_url = clean where id = me;
  return clean;
end $$;

create or replace function public.linkedin_optional_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.needs_linkedin(), public.set_linkedin(text) from public, anon;
grant execute on function public.needs_linkedin(), public.set_linkedin(text), public.linkedin_optional_ready() to authenticated;
