-- Forge Copilot: a per-person daily limit, so the AI assistant's cost stays bounded.
-- Run after invites.sql. Additive: nothing existing changes.
--
-- The count lives here (not in server memory) because serverless functions don't share memory.
-- Nobody reads or writes the table directly: copilot_take() is the only way in.

create table public.copilot_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  uses integer not null default 0 check (uses >= 0),
  primary key (user_id, day)
);
alter table public.copilot_usage enable row level security;
-- No policies: the table is invisible to clients. Only copilot_take() (security definer) touches it.

-- Takes one use for today if any are left. Returns how many are left after this one,
-- or -1 when today's limit is used up (or nobody is signed in).
create function public.copilot_take() returns integer
language plpgsql security definer set search_path = public as $$
declare
  daily constant integer := 25;
  n integer;
begin
  if auth.uid() is null then return -1; end if;
  insert into public.copilot_usage as u (user_id, day, uses) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set uses = u.uses + 1 where u.uses < daily
  returning u.uses into n;
  if n is null then return -1; end if;
  return daily - n;
end $$;

-- Lets the app check that this file has run, without touching anyone's count.
create function public.copilot_ready() returns boolean language sql stable as $$ select true $$;

revoke all on table public.copilot_usage from anon, authenticated, public;
revoke execute on function public.copilot_take(), public.copilot_ready() from anon, public;
grant execute on function public.copilot_take(), public.copilot_ready() to authenticated;
