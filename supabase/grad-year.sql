-- Step 34: graduation year on profiles (Linear FIX-48). Optional; recruiters filter by class year
-- first, so Find builders offers it as a filter and cards show "Class of 2027".
-- Additive and safe to re-run. Readable and editable like the other profile fields (profile-extras.sql):
-- every signed-in member can read it; you can change only your own (the profiles update policy).
alter table public.profiles add column if not exists grad_year smallint
  check (grad_year is null or grad_year between 1960 and 2045);
grant select (grad_year), update (grad_year) on public.profiles to authenticated;
