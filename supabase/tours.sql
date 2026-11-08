-- Guided tours: which tours and update notes each member has finished or closed,
-- so the first-time tour runs once per account (on any device) and each "What's new" shows once.
-- Run after projects.sql. Only you can read or add your own rows.

create table public.seen_tours (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 80),
  seen_at timestamptz not null default now(),
  primary key (user_id, key)
);

revoke all on public.seen_tours from anon, authenticated;
alter table public.seen_tours enable row level security;
grant select, delete on public.seen_tours to authenticated;
grant insert (key) on public.seen_tours to authenticated;
create policy "your tours" on public.seen_tours for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
