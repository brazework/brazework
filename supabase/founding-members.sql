-- Step 91: founding members (Linear FIX-241). The first 1,000 members to finish signing up get a
-- permanent number, 1 to 1000, shown as a "Founding member" badge. The perk that comes with it is
-- decided later (the issue stays open for it).
--
-- - Who counts: profiles that finished onboarding, in the order they did, except Brazework's own
--   admins (forge_admins). Existing members are numbered by when they joined.
-- - Once given, a number never changes or moves: deleting an account frees nothing, and nobody can
--   set or change their own (no update grant on the column; only this step's trigger writes it).
-- - Numbers come from a sequence, so two sign-ups at once never get the same one.
-- Additive and safe to re-run.

alter table public.profiles add column if not exists founding_number integer
  check (founding_number is null or founding_number between 1 and 1000);
create unique index if not exists profiles_founding_number_key on public.profiles (founding_number) where founding_number is not null;
grant select (founding_number) on public.profiles to authenticated;

-- The next number, or null once all 1,000 are given out. A sequence, so a number is never handed out
-- twice, even if its member deletes their account.
create sequence if not exists public.founding_number_seq;
revoke all on sequence public.founding_number_seq from anon, authenticated, public;
create or replace function public.next_founding_number() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  n := nextval('public.founding_number_seq');
  return case when n <= 1000 then n end;
end $$;
revoke execute on function public.next_founding_number() from anon, authenticated, public;

-- Finishing onboarding is the moment someone becomes a member: give them a number if any are left.
create or replace function public.profiles_founding_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Never changed once set, whoever asks.
  if tg_op = 'UPDATE' and old.founding_number is not null then new.founding_number := old.founding_number; return new; end if;
  if tg_op = 'UPDATE' and new.founding_number is distinct from old.founding_number then new.founding_number := old.founding_number; end if;
  if new.onboarded and new.founding_number is null and (tg_op = 'INSERT' or not old.onboarded)
     and not exists (select 1 from public.forge_admins a where a.uid = new.id) then
    new.founding_number := public.next_founding_number();
  end if;
  return new;
end $$;
revoke execute on function public.profiles_founding_number() from anon, authenticated, public;
drop trigger if exists profiles_founding_number on public.profiles;
create trigger profiles_founding_number before insert or update of onboarded, founding_number on public.profiles
  for each row execute function public.profiles_founding_number();

-- Members who are already here, in the order they joined (only the first time this step runs).
do $$
declare r record; n integer;
begin
  if exists (select 1 from public.profiles where founding_number is not null) then return; end if;
  alter table public.profiles disable trigger profiles_founding_number;
  n := 0;
  for r in select p.id from public.profiles p
            where p.onboarded and not exists (select 1 from public.forge_admins a where a.uid = p.id)
            order by p.created_at, p.id limit 1000 loop
    n := n + 1;
    update public.profiles set founding_number = n where id = r.id;
  end loop;
  alter table public.profiles enable trigger profiles_founding_number;
  -- The next member gets the number after the last one given here.
  perform setval('public.founding_number_seq', greatest(n, 1), n > 0);
end $$;

-- How many founding places are left, for a "join as one of the first 1,000" line on the landing page.
create or replace function public.founding_places_left() returns integer
language sql stable security definer set search_path = public as $$
  select greatest(0, 1000 - (select case when is_called then last_value else 0 end from public.founding_number_seq))::integer
$$;
grant execute on function public.founding_places_left() to anon, authenticated;

create or replace function public.founding_members_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
