-- Sign-up rules in the database, not only in the app: whoever calls Supabase Auth (the app, the API
-- directly, a script), a student account needs a school email and everyone must be old enough.
-- Schools are recognized by an academic domain (.edu, .ac.uk, ...) or by the school_domains list,
-- which Forge admins extend for schools that don't use one. Existing accounts aren't affected.
-- Run after reports-more.sql. Additive.

create table public.school_domains (
  domain text primary key check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  school text not null default '' check (char_length(school) <= 160),
  added_at timestamptz not null default now()
);
alter table public.school_domains enable row level security;
revoke all on public.school_domains from anon, authenticated;

insert into public.app_config (key, value) values ('min_age', '18') on conflict (key) do nothing;

-- A school email: an academic domain, or a listed school domain (or a subdomain of one).
create function public.is_school_email(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  with h as (select lower(split_part(coalesce(p_email, ''), '@', 2)) as host)
  select h.host ~ '(^|\.)([a-z0-9-]+\.edu(\.[a-z]{2})?|[a-z0-9-]+\.ac\.[a-z]{2})$'
      or exists (select 1 from public.school_domains d where h.host = d.domain or right(h.host, char_length(d.domain) + 1) = '.' || d.domain)
  from h
$$;
revoke execute on function public.is_school_email(text) from public;
grant execute on function public.is_school_email(text) to anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); bd date;
begin
  if m ? 'accountType' then
    begin bd := (m->>'birthday')::date;
    exception when others then raise exception 'Enter your birthday.' using errcode = 'P0001'; end;
    if bd is null or bd > (now() - make_interval(years => public.config_int('min_age', 18)))::date then
      raise exception 'You must be at least % to create an account.', public.config_int('min_age', 18) using errcode = 'P0001';
    end if;
    if m->>'accountType' = 'student' and not public.is_school_email(new.email) then
      raise exception 'Use your university email (for example, ending in .edu or .ac.uk).' using errcode = 'P0001';
    end if;
    insert into public.profiles (id, first_name, last_name, birthday, account_type)
    values (new.id, left(coalesce(m->>'firstName', ''), 80), left(coalesce(m->>'lastName', ''), 80),
            coalesce(m->>'birthday', ''),
            case when m->>'accountType' = 'student' then 'student' else 'professional' end)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

-- The verified-club rule uses the same definition of a school email.
create or replace function public.club_is_verified(p_cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.community_members cm join auth.users u on u.id = cm.uid
       where cm.community_id = p_cid and public.role_rank(cm.role) >= 3 and u.email_confirmed_at is not null
         and public.is_school_email(u.email))
     and (select count(distinct m.owner_id) from public.milestones m where m.community_id = p_cid and m.status = 'verified')
         >= public.config_int('verified_club_min_members', 5)
$$;
