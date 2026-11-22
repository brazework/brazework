-- Weight each Ember action while retaining the shared daily usage counter.
begin;

create or replace function public.ember_take(p_action text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  member uuid := auth.uid();
  usage_day date := (now() at time zone 'UTC')::date;
  cost integer := case p_action
    when 'ask' then 1
    when 'post' then 2
    when 'group_ask' then 2
    when 'chat_summary' then 2
    when 'organize' then 2
    when 'writeup' then 3
  end;
  daily integer;
  spent integer;
begin
  if member is null or cost is null then return -1; end if;
  daily := case when public.has_plus() then 50 else 15 end;

  insert into public.copilot_usage as usage (user_id, day, uses)
  values (member, usage_day, cost)
  on conflict (user_id, day) do update set uses = usage.uses + cost
  where usage.uses + cost <= daily
  returning usage.uses into spent;

  if spent is null then return -1; end if;
  return daily - spent;
end $$;

revoke execute on function public.ember_take(text) from public, anon;
grant execute on function public.ember_take(text) to authenticated;

-- Keep the old application release working while the database rolls out first.
create or replace function public.copilot_take() returns integer
language sql security definer set search_path = '' as $$
  select public.ember_take('ask')
$$;

commit;
