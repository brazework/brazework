-- Student onboarding accepts any email. A verified school email unlocks the student price.
begin;

create or replace function public.signup_check(p_email text, p_account_type text, p_birthday text) returns date
language plpgsql stable security definer set search_path = '' as $$
declare bd date;
begin
  begin bd := nullif(trim(coalesce(p_birthday, '')), '')::date;
  exception when others then raise exception 'Enter your birthday.' using errcode = 'P0001'; end;
  if bd is null then raise exception 'Enter your birthday.' using errcode = 'P0001'; end if;
  if bd > (now() - make_interval(years => public.config_int('min_age', 18)))::date then
    raise exception 'You must be at least % to create an account.', public.config_int('min_age', 18) using errcode = 'P0001';
  end if;
  return bd;
end $$;
revoke execute on function public.signup_check(text, text, text) from public, anon, authenticated;

create or replace function public.set_account_type(p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if p_type is null or p_type not in ('student', 'professional') then raise exception 'Pick Studying or Working.' using errcode = 'P0001'; end if;
  update public.profiles set account_type = p_type where id = me;
  if not found then raise exception 'Finish setting up your account first.' using errcode = 'P0001'; end if;
  return p_type;
end $$;

-- Only the confirmed primary address on the current account qualifies for checkout.
create or replace function public.student_plus_eligible() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
     where p.id = auth.uid()
       and p.account_type = 'student'
       and u.email_confirmed_at is not null
       and public.is_school_email(u.email)
  )
$$;
revoke execute on function public.student_plus_eligible() from public, anon;
grant execute on function public.student_plus_eligible() to authenticated;

commit;
