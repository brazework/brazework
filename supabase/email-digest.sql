-- The weekly email digest: each member can turn it off (on by default), and each send is recorded
-- per week so a cron that runs twice never emails anyone twice. Recipients (with their email) are
-- readable only by trusted server code with the service role. Run after project-specs.sql. Additive.

create table public.email_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weekly_digest boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
revoke all on public.email_prefs from anon, authenticated;
grant select on public.email_prefs to authenticated;
create policy "your email settings" on public.email_prefs for select to authenticated using (user_id = auth.uid());

create function public.save_email_prefs(p_weekly boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  insert into public.email_prefs (user_id, weekly_digest) values (auth.uid(), p_weekly)
  on conflict (user_id) do update set weekly_digest = excluded.weekly_digest, updated_at = now();
end $$;
revoke execute on function public.save_email_prefs(boolean) from anon, public;
grant execute on function public.save_email_prefs(boolean) to authenticated;

create table public.digest_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.digest_sends enable row level security;
revoke all on public.digest_sends from anon, authenticated;

-- Who gets this week's digest: confirmed, onboarded members who haven't turned it off and haven't
-- had this week's yet. Paged by id. Service role only.
create function public.digest_recipients(p_after uuid default null, p_limit int default 200)
returns table (user_id uuid, email text, first_name text)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text, p.first_name
  from public.profiles p join auth.users u on u.id = p.id
  where p.onboarded and u.email_confirmed_at is not null
    and coalesce((select e.weekly_digest from public.email_prefs e where e.user_id = p.id), true)
    and not exists (select 1 from public.digest_sends s where s.user_id = p.id and s.week = date_trunc('week', now())::date)
    and (p_after is null or p.id > p_after)
  order by p.id limit least(greatest(p_limit, 1), 500)
$$;
revoke execute on function public.digest_recipients(uuid, int) from anon, authenticated, public;
grant execute on function public.digest_recipients(uuid, int) to service_role;
