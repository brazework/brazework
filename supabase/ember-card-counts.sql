-- Step 109: how Torch is doing, in numbers only (Josh, 26 Nov 2026: "measure first"). For each member
-- and day: questions asked, free follow-ups used, cards Torch prepared, cards confirmed, dismissed or
-- refused, and sets of answer buttons offered. Never what anyone said or what a card held.
--
-- The counts sit on the existing usage row (copilot_usage, one per member per day), which clients can't
-- read or write: ember_take() counts asks and follow-ups as it spends them, and ember_note() counts the
-- rest. Brazework admins see totals across everyone (admin_torch_metrics()), never one member's numbers.
--
-- Additive: new columns with defaults, ember_take() redefined with the same costs as
-- supabase/ember-follow.sql, and two new functions.
begin;

alter table public.copilot_usage
  add column if not exists asks integer not null default 0 check (asks >= 0),
  add column if not exists follows_used integer not null default 0 check (follows_used >= 0),
  add column if not exists cards_prepared integer not null default 0 check (cards_prepared >= 0),
  add column if not exists cards_confirmed integer not null default 0 check (cards_confirmed >= 0),
  add column if not exists cards_dismissed integer not null default 0 check (cards_dismissed >= 0),
  add column if not exists cards_failed integer not null default 0 check (cards_failed >= 0),
  add column if not exists choices_offered integer not null default 0 check (choices_offered >= 0);

-- Same costs and follow-ups as supabase/ember-follow.sql; it also counts each ask and follow-up it gives.
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

  if p_action = 'follow' then
    update public.copilot_usage as usage
      set follows_left = usage.follows_left - 1, follows_used = usage.follows_used + 1
    where usage.user_id = member and usage.day = usage_day and usage.follows_left > 0
    returning usage.uses into spent;
    if spent is null then return -1; end if;
    return greatest(daily - spent, 0);
  end if;

  insert into public.copilot_usage as usage (user_id, day, uses, follows_left, asks)
  values (member, usage_day, cost, case when p_action = 'ask' then 3 else 0 end, case when p_action = 'ask' then 1 else 0 end)
  on conflict (user_id, day) do update
    set uses = usage.uses + cost,
        follows_left = case when p_action = 'ask' then 3 else usage.follows_left end,
        asks = usage.asks + case when p_action = 'ask' then 1 else 0 end
  where usage.uses + cost <= daily
  returning usage.uses into spent;

  if spent is null then return -1; end if;
  return daily - spent;
end $$;

revoke execute on function public.ember_take(text) from public, anon;
grant execute on function public.ember_take(text) to authenticated;

-- Counts what happened to Torch's cards for the signed-in member today: 'prepared' and 'choices' from
-- the server after an answer, 'confirmed', 'dismissed' and 'failed' from the card once the server has
-- answered. At most 20 at a time and 10,000 a day per count, so a stuck page can't run them up. Anything
-- else is ignored. Returns nothing: counting never gets in the way of the member.
create or replace function public.ember_note(p_what text, p_n integer default 1) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member uuid := auth.uid();
  usage_day date := (now() at time zone 'UTC')::date;
  n integer := least(greatest(coalesce(p_n, 0), 0), 20);
begin
  if member is null or n = 0 or p_what is null or p_what not in ('prepared', 'confirmed', 'dismissed', 'failed', 'choices') then return; end if;
  insert into public.copilot_usage (user_id, day) values (member, usage_day) on conflict (user_id, day) do nothing;
  update public.copilot_usage as usage set
    cards_prepared = least(usage.cards_prepared + case when p_what = 'prepared' then n else 0 end, 10000),
    cards_confirmed = least(usage.cards_confirmed + case when p_what = 'confirmed' then n else 0 end, 10000),
    cards_dismissed = least(usage.cards_dismissed + case when p_what = 'dismissed' then n else 0 end, 10000),
    cards_failed = least(usage.cards_failed + case when p_what = 'failed' then n else 0 end, 10000),
    choices_offered = least(usage.choices_offered + case when p_what = 'choices' then n else 0 end, 10000)
  where usage.user_id = member and usage.day = usage_day;
end $$;

revoke execute on function public.ember_note(text, integer) from public, anon;
grant execute on function public.ember_note(text, integer) to authenticated;

-- The admin page's Torch numbers: totals across all members, by day for the last 14 days (UTC), and for
-- the last 7 days against the 7 before. Brazework admins only.
create or replace function public.admin_torch_metrics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'UTC')::date;
  r jsonb;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  with days as (
    select generate_series(today - 13, today, interval '1 day')::date as day
  ),
  per_day as (
    select d.day,
      count(u.user_id) filter (where u.asks > 0 or u.follows_used > 0) as members,
      coalesce(sum(u.asks), 0) as asks,
      coalesce(sum(u.follows_used), 0) as follows,
      coalesce(sum(u.cards_prepared), 0) as prepared,
      coalesce(sum(u.cards_confirmed), 0) as confirmed,
      coalesce(sum(u.cards_dismissed), 0) as dismissed,
      coalesce(sum(u.cards_failed), 0) as failed,
      coalesce(sum(u.choices_offered), 0) as choices
    from days d left join public.copilot_usage u on u.day = d.day
    group by d.day
  ),
  window_totals as (
    select case when u.day > today - 7 then 'last_7' else 'prev_7' end as span,
      count(distinct u.user_id) filter (where u.asks > 0 or u.follows_used > 0) as members,
      coalesce(sum(u.asks), 0) as asks,
      coalesce(sum(u.follows_used), 0) as follows,
      coalesce(sum(u.cards_prepared), 0) as prepared,
      coalesce(sum(u.cards_confirmed), 0) as confirmed,
      coalesce(sum(u.cards_dismissed), 0) as dismissed,
      coalesce(sum(u.cards_failed), 0) as failed,
      coalesce(sum(u.choices_offered), 0) as choices
    from public.copilot_usage u
    where u.day > today - 14
    group by 1
  )
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(to_jsonb(p) order by p.day) from per_day p), '[]'::jsonb),
    'last_7', coalesce((select to_jsonb(w) - 'span' from window_totals w where w.span = 'last_7'), '{"members":0,"asks":0,"follows":0,"prepared":0,"confirmed":0,"dismissed":0,"failed":0,"choices":0}'::jsonb),
    'prev_7', coalesce((select to_jsonb(w) - 'span' from window_totals w where w.span = 'prev_7'), '{"members":0,"asks":0,"follows":0,"prepared":0,"confirmed":0,"dismissed":0,"failed":0,"choices":0}'::jsonb)
  ) into r;
  return r;
end $$;

revoke execute on function public.admin_torch_metrics() from public, anon;
grant execute on function public.admin_torch_metrics() to authenticated;

create or replace function public.ember_card_counts_ready() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke execute on function public.ember_card_counts_ready() from public, anon;
grant execute on function public.ember_card_counts_ready() to authenticated;

commit;
