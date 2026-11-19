-- Money paths for launch (docs/product-hunt.md): Plus for builders, and requests from companies, clubs'
-- sponsors and schools that land in the founders' admin queue. Run after waiting-cards.sql. Additive.
--
-- Plus is one flag, has_plus(): a row in member_plans that only the Stripe webhook writes (with the
-- service key), so nobody can give themselves Plus. What Plus unlocks checks has_plus() in the
-- database, starting with who looked: 7 days on free, 90 with Plus (my_company_viewers()).
--
-- A request (a pilot for search seats, sponsoring a chapter or a challenge, a school's demo, the Plus
-- waitlist) is made only through request_sales(), as a signed-in member: it writes an admin_queue
-- item with their name and account email, so nobody types an address and nobody can file one for
-- someone else. At most 5 a day per member, and the same ask twice in a day is one.

-- ---------- Plus ----------
create table if not exists public.member_plans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'plus' check (plan = 'plus'),
  status text not null default 'active' check (status in ('active', 'canceled')),
  provider text not null default 'stripe' check (char_length(provider) <= 40),
  provider_ref text not null default '' check (char_length(provider_ref) <= 200),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.member_plans enable row level security;
drop policy if exists "own plan: read" on public.member_plans;
create policy "own plan: read" on public.member_plans for select to authenticated using (user_id = auth.uid());
drop policy if exists "members only" on public.member_plans;
create policy "members only" on public.member_plans as restrictive for select to authenticated using ((select public.is_member()));
revoke all on public.member_plans from anon, authenticated;
grant select on public.member_plans to authenticated;

-- The one flag: does the signed-in member have Plus right now?
create or replace function public.has_plus() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.member_plans
                  where user_id = auth.uid() and status = 'active' and (current_period_end is null or current_period_end > now()))
$$;
revoke execute on function public.has_plus() from public, anon;
grant execute on function public.has_plus() to authenticated;

-- Who looked, by company, newest first: the last 7 days, or 90 with Plus. Named by company only,
-- never the person (who-looked.sql).
create or replace function public.my_company_viewers(p_days integer default 90) returns jsonb
language sql stable security definer set search_path = public as $$
  with lim as (select least(greatest(coalesce(p_days, 7), 1), case when public.has_plus() then 90 else 7 end) as days),
  v as (
    select viewer, max(viewed_at) as at
      from public.profile_views, lim
     where profile_id = auth.uid() and viewed_at > now() - make_interval(days => lim.days)
     group by viewer
  ), co as (
    select o.name, max(v.at) as at
      from v
      join public.organization_admins a on a.uid = v.viewer
      join public.organizations o on o.id = a.org_id and o.type = 'company' and o.verification_status = 'verified'
     group by o.name
  )
  select jsonb_build_object(
    'days', (select days from lim),
    'plus', public.has_plus(),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'at', c.at) order by c.at desc) from (select * from co order by at desc limit 50) c), '[]'::jsonb))
$$;
revoke execute on function public.my_company_viewers(integer) from public, anon;
grant execute on function public.my_company_viewers(integer) to authenticated;

-- ---------- Requests into the admin queue ----------
alter table public.admin_queue drop constraint if exists admin_queue_kind_check;
alter table public.admin_queue add constraint admin_queue_kind_check
  check (kind in ('verify_outlier', 'dispute', 'duplicate_club', 'report', 'sales'));

create or replace function public.request_sales(p_kind text, p_org text, p_club text, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  who text;
  addr text;
  label text;
  org text := left(btrim(regexp_replace(coalesce(p_org, ''), '\s+', ' ', 'g')), 120);
  note text := left(btrim(coalesce(p_note, '')), 500);
  club text := nullif(btrim(coalesce(p_club, '')), '');
  club_name text;
  line text;
begin
  if me is null then raise exception 'Log in first, so we know where to reply.' using errcode = '42501'; end if;
  label := case p_kind when 'talent' then 'Find builders: search seats' when 'chapter' then 'Sponsor a chapter'
                       when 'challenge' then 'Sponsor a challenge' when 'school' then 'School or network demo'
                       when 'plus' then 'Plus waitlist' end;
  if label is null then raise exception 'Pick what you''d like.' using errcode = 'P0001'; end if;
  if p_kind in ('talent', 'chapter', 'challenge', 'school') and char_length(org) < 2 then
    raise exception 'Add your organization''s name.' using errcode = 'P0001';
  end if;
  if club is not null then
    select name into club_name from public.communities where id = club;
    if club_name is null then club := null; end if;
  end if;
  select btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into who from public.profiles where id = me;
  if who is null then raise exception 'Finish setting up your account first.' using errcode = 'P0001'; end if;
  select email into addr from auth.users where id = me;
  -- The same ask twice in a day is one; at most 5 a day.
  if exists (select 1 from public.admin_queue where kind = 'sales' and subject_id = me::text and created_at > now() - interval '1 day'
              and detail like label || ' ·%' and coalesce(community_id, '') = coalesce(club, '')) then
    return 'already';
  end if;
  if (select count(*) from public.admin_queue where kind = 'sales' and subject_id = me::text and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You''ve sent 5 requests today. We''ll be in touch.' using errcode = 'P0001';
  end if;
  line := label || ' · ' || coalesce(nullif(who, ''), 'A member') || ' <' || coalesce(addr, '') || '>'
          || case when org <> '' then ' · ' || org else '' end
          || case when club_name is not null then ' · for ' || club_name else '' end
          || case when note <> '' then ' · "' || note || '"' else '' end;
  insert into public.admin_queue (kind, subject_id, community_id, detail) values ('sales', me::text, club, left(line, 1000));
  return 'requested';
end $$;
revoke execute on function public.request_sales(text, text, text, text) from public, anon;
grant execute on function public.request_sales(text, text, text, text) to authenticated;

create or replace function public.money_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.money_ready() to authenticated;
