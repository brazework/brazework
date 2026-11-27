-- One daily allowance across all Ember entry points. Keep existing usage and the RPC contract.
begin;

create or replace function public.copilot_take() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  member uuid := auth.uid();
  usage_day date := (now() at time zone 'UTC')::date;
  daily integer;
  n integer;
begin
  if member is null then return -1; end if;
  daily := case when public.has_plus() then 50 else 15 end;

  insert into public.copilot_usage as u (user_id, day, uses) values (member, usage_day, 1)
  on conflict (user_id, day) do update set uses = u.uses + 1 where u.uses < daily
  returning u.uses into n;

  if n is null then return -1; end if;
  return daily - n;
end $$;

create or replace function public.ember_allowances_ready() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke execute on function public.ember_allowances_ready() from public, anon;
grant execute on function public.ember_allowances_ready() to authenticated;

commit;
