-- Torch carries on after a yes (docs/superpowers/specs/2026-11-26-ember-follow-through-design.md, part 4).
-- When a member confirms one of Torch's cards and the card says what comes next, or taps one of the
-- answers Torch offered, Torch carries on by itself. Those turns are free, up to 3 after each paid ask
-- (Josh's call, 2026-11-26): a three-step job costs one credit, not four.
--
-- Additive: a column on the existing usage counter (the table stays invisible to clients), and
-- ember_take() learns one more action, 'follow', which costs nothing and spends one of the follows.
-- Every other action costs what it did (supabase/ember-credits.sql).
begin;

alter table public.copilot_usage
  add column if not exists follows_left integer not null default 0 check (follows_left between 0 and 3);

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
    when 'follow' then 0
  end;
  daily integer;
  spent integer;
begin
  if member is null or cost is null then return -1; end if;
  daily := case when public.has_plus() then 50 else 15 end;

  -- A follow costs no credit and spends one of today's follows; none carry over to the next day.
  if p_action = 'follow' then
    update public.copilot_usage as usage set follows_left = usage.follows_left - 1
    where usage.user_id = member and usage.day = usage_day and usage.follows_left > 0
    returning usage.uses into spent;
    if spent is null then return -1; end if;
    return greatest(daily - spent, 0);
  end if;

  -- Each paid ask to Torch comes with 3 follows (set, not added: they don't pile up).
  insert into public.copilot_usage as usage (user_id, day, uses, follows_left)
  values (member, usage_day, cost, case when p_action = 'ask' then 3 else 0 end)
  on conflict (user_id, day) do update
    set uses = usage.uses + cost,
        follows_left = case when p_action = 'ask' then 3 else usage.follows_left end
  where usage.uses + cost <= daily
  returning usage.uses into spent;

  if spent is null then return -1; end if;
  return daily - spent;
end $$;

revoke execute on function public.ember_take(text) from public, anon;
grant execute on function public.ember_take(text) to authenticated;

create or replace function public.ember_follow_ready() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke execute on function public.ember_follow_ready() from public, anon;
grant execute on function public.ember_follow_ready() to authenticated;

commit;
