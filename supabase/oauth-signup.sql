-- Sign-up with Google, GitHub or LinkedIn. Someone who arrives that way has a verified email from
-- the provider but none of what the sign-up form collects (account type, name, birthday), so the
-- profile trigger makes no profile for them (it only acts on sign-up metadata with an accountType).
-- They finish in onboarding with finish_signup(), which holds them to the same rules as the form:
-- old enough, and a school email for a student account. Until then they have no profile, and since
-- every member table references profiles, they can't write anything.
-- The rules live in one place, signup_check(), used by the trigger and by finish_signup().
-- Run after witness-invites.sql. Additive: same messages and behavior for email sign-ups.

create or replace function public.signup_check(p_email text, p_account_type text, p_birthday text) returns date
language plpgsql stable security definer set search_path = public as $$
declare bd date;
begin
  begin bd := nullif(trim(coalesce(p_birthday, '')), '')::date;
  exception when others then raise exception 'Enter your birthday.' using errcode = 'P0001'; end;
  if bd is null then raise exception 'Enter your birthday.' using errcode = 'P0001'; end if;
  if bd > (now() - make_interval(years => public.config_int('min_age', 18)))::date then
    raise exception 'You must be at least % to create an account.', public.config_int('min_age', 18) using errcode = 'P0001';
  end if;
  if p_account_type = 'student' and not public.is_school_email(p_email) then
    raise exception 'Use your university email (for example, ending in .edu or .ac.uk).' using errcode = 'P0001';
  end if;
  return bd;
end $$;
revoke execute on function public.signup_check(text, text, text) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m ? 'accountType' then
    perform public.signup_check(new.email, m->>'accountType', m->>'birthday');
    insert into public.profiles (id, first_name, last_name, birthday, account_type)
    values (new.id, left(coalesce(m->>'firstName', ''), 80), left(coalesce(m->>'lastName', ''), 80),
            coalesce(m->>'birthday', ''),
            case when m->>'accountType' = 'student' then 'student' else 'professional' end)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

-- The signed-in member, with no profile yet (they came in through Google, GitHub or LinkedIn),
-- gives what the sign-up form asks for. The email is the one their provider verified.
create or replace function public.finish_signup(p_account_type text, p_first_name text, p_last_name text, p_birthday text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); u record; bd date; fn text := trim(coalesce(p_first_name, '')); ln text := trim(coalesce(p_last_name, ''));
begin
  if me is null then raise exception 'Log in first.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = me) then
    raise exception 'Your account is already set up.' using errcode = 'P0001';
  end if;
  select email, email_confirmed_at into u from auth.users where id = me;
  if u.email is null or u.email = '' or u.email_confirmed_at is null then
    raise exception 'Confirm your email first. Check your inbox for the link.' using errcode = 'P0001';
  end if;
  if coalesce(p_account_type, '') not in ('student', 'professional') then
    raise exception 'Choose student or professional.' using errcode = 'P0001';
  end if;
  if fn = '' or ln = '' then raise exception 'Enter your first and last name.' using errcode = 'P0001'; end if;
  if char_length(fn) > 80 or char_length(ln) > 80 then raise exception 'Names can be up to 80 characters.' using errcode = 'P0001'; end if;
  bd := public.signup_check(u.email, p_account_type, p_birthday);
  insert into public.profiles (id, first_name, last_name, birthday, account_type)
  values (me, fn, ln, bd::text, p_account_type)
  on conflict (id) do nothing;
end $$;
revoke execute on function public.finish_signup(text, text, text, text) from public, anon;
grant execute on function public.finish_signup(text, text, text, text) to authenticated;

create or replace function public.oauth_signup_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.oauth_signup_ready() to authenticated;
