-- Studying or working, changed later (Settings → Profile). Run after oauth-signup.sql. Additive.
-- People finish school: a student account becomes a professional one with one tap, and the app's
-- wording follows (Home asks what you're working on, not what you're building this semester).
-- Becoming a student holds you to the sign-up rule (supabase/oauth-signup.sql): a university email.
create or replace function public.set_account_type(p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mail text;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if p_type is null or p_type not in ('student', 'professional') then raise exception 'Pick Studying or Working.' using errcode = 'P0001'; end if;
  if p_type = 'student' then
    select email into mail from auth.users where id = me;
    if not public.is_school_email(mail) then
      raise exception 'A student account needs your university email. Change your email to it first, or keep Working.' using errcode = 'P0001';
    end if;
  end if;
  update public.profiles set account_type = p_type where id = me;
  if not found then raise exception 'Finish setting up your account first.' using errcode = 'P0001'; end if;
  return p_type;
end $$;

create or replace function public.account_type_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.set_account_type(text) from anon, public;
grant execute on function public.set_account_type(text), public.account_type_ready() to authenticated;
