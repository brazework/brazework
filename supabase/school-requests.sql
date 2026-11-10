-- "Request my school": a student whose school email isn't recognized asks for it to be added. One
-- row per domain (repeat requests count up), Forge admins add it to school_domains or dismiss it.
-- Anyone can ask (they can't sign up yet), so the function caps requests per hour. Run after
-- signup-rules.sql. Additive.

create table public.school_requests (
  id bigint generated always as identity primary key,
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  school text not null check (char_length(school) between 2 and 160),
  contact text not null default '' check (char_length(contact) <= 200),
  asks int not null default 1,
  status text not null default 'open' check (status in ('open', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.school_requests enable row level security;
revoke all on public.school_requests from anon, authenticated;
grant select on public.school_requests to authenticated;
create policy "admins read school requests" on public.school_requests for select to authenticated using (public.is_forge_admin());

create function public.request_school(p_domain text, p_school text, p_contact text default '') returns text
language plpgsql security definer set search_path = public as $$
declare d text := lower(btrim(coalesce(p_domain, ''))); s text := btrim(coalesce(p_school, ''));
begin
  d := regexp_replace(regexp_replace(d, '^.*@', ''), '^www\.', '');
  if d !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then raise exception 'Enter your school''s email domain, like hartford.edu.' using errcode = 'P0001'; end if;
  if char_length(s) < 2 then raise exception 'Enter your school''s name.' using errcode = 'P0001'; end if;
  if public.is_school_email('x@' || d) then return 'listed'; end if;
  if (select count(*) from public.school_requests where updated_at > now() - interval '1 hour') >= 50 then
    raise exception 'Lots of requests right now. Try again in an hour.' using errcode = 'P0001';
  end if;
  insert into public.school_requests (domain, school, contact) values (d, left(s, 160), left(btrim(coalesce(p_contact, '')), 200))
  on conflict (domain) do update set asks = public.school_requests.asks + 1, updated_at = now(),
    status = case when public.school_requests.status = 'dismissed' then 'open' else public.school_requests.status end;
  return 'requested';
end $$;
revoke execute on function public.request_school(text, text, text) from public;
grant execute on function public.request_school(text, text, text) to anon, authenticated;

create function public.decide_school_request(p_id bigint, p_add boolean) returns text
language plpgsql security definer set search_path = public as $$
declare r public.school_requests;
begin
  if not public.is_forge_admin() then raise exception 'Forge admins only.' using errcode = '42501'; end if;
  select * into r from public.school_requests where id = p_id;
  if r.id is null then raise exception 'No such request.' using errcode = 'P0001'; end if;
  if p_add then insert into public.school_domains (domain, school) values (r.domain, r.school) on conflict (domain) do nothing; end if;
  update public.school_requests set status = case when p_add then 'added' else 'dismissed' end, updated_at = now() where id = p_id;
  return case when p_add then 'added' else 'dismissed' end;
end $$;
revoke execute on function public.decide_school_request(bigint, boolean) from anon, public;
grant execute on function public.decide_school_request(bigint, boolean) to authenticated;
