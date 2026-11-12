-- Goals (Linear FIX-95): what a member is working toward (an internship, a first job, grad school, a
-- research lab, a competition, funding) and, optionally, what in (a target like "power electronics").
-- One active goal at a time; reaching it closes it ("met", with a line about how) and it stays on the
-- profile as a result. Run after vouches.sql. Additive; safe to run again.
--
-- Who sees a goal: its owner always; other signed-in members when it's visible (the default), so a
-- company searching can filter by it. Setting a visible goal also ticks the matching "Open to" on the
-- profile (internship → internships, job → full_time, research → research), which talent search
-- already filters on.
--
-- Who writes: only set_goal, reach_goal and drop_goal, for yourself.

create table if not exists public.member_goals (
  id bigint generated always as identity primary key,
  uid uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('internship', 'job', 'grad', 'research', 'competition', 'funding')),
  target text not null default '' check (char_length(target) <= 80 and target !~ '[<>]'),
  visible boolean not null default true,
  status text not null default 'active' check (status in ('active', 'met', 'dropped')),
  met_note text not null default '' check (char_length(met_note) <= 160 and met_note !~ '[<>]'),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists member_goals_one_active on public.member_goals (uid) where status = 'active';
create index if not exists member_goals_uid_idx on public.member_goals (uid, created_at desc);
create index if not exists member_goals_kind_idx on public.member_goals (kind) where status = 'active' and visible;
alter table public.member_goals enable row level security;
revoke all on public.member_goals from anon, authenticated;
grant select on public.member_goals to authenticated;
drop policy if exists "goals you can see" on public.member_goals;
create policy "goals you can see" on public.member_goals for select to authenticated
  using (uid = auth.uid() or (visible and status in ('active', 'met')));

-- "Open to" that a goal implies (profile-extras.sql's list).
create or replace function public.goal_open_to(p_kind text) returns text
language sql immutable as $$
  select case p_kind when 'internship' then 'internships' when 'job' then 'full_time' when 'research' then 'research' else null end
$$;

-- Set (or change) your goal. The old active goal, if any, is dropped (kept in the history).
create or replace function public.set_goal(p_kind text, p_target text default '', p_visible boolean default true) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t text := btrim(coalesce(p_target, ''));
  o text := public.goal_open_to(p_kind);
  new_id bigint;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_kind not in ('internship', 'job', 'grad', 'research', 'competition', 'funding') then raise exception 'Pick a goal.' using errcode = 'P0001'; end if;
  if char_length(t) > 80 or t ~ '[<>]' then raise exception 'Keep what it''s in under 80 characters.' using errcode = 'P0001'; end if;
  if (select count(*) from public.member_goals where uid = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You''ve changed your goal a lot today. Try again tomorrow.' using errcode = 'P0001';
  end if;
  update public.member_goals set status = 'dropped', closed_at = now() where uid = me and status = 'active';
  insert into public.member_goals (uid, kind, target, visible) values (me, p_kind, t, coalesce(p_visible, true)) returning id into new_id;
  if coalesce(p_visible, true) and o is not null then
    update public.profiles set open_to = open_to || o
     where id = me and not (o = any (open_to)) and cardinality(open_to) < 4;
  end if;
  return new_id;
end $$;

-- You got there: close the goal with a line about how ("Accepted an offer at Volt Systems").
create or replace function public.reach_goal(p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if char_length(n) > 160 or n ~ '[<>]' then raise exception 'Keep it under 160 characters.' using errcode = 'P0001'; end if;
  update public.member_goals set status = 'met', met_note = n, closed_at = now() where uid = auth.uid() and status = 'active';
  if not found then raise exception 'You don''t have a goal right now.' using errcode = 'P0001'; end if;
end $$;

-- Stop working toward it, without saying it was met.
create or replace function public.drop_goal() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  update public.member_goals set status = 'dropped', closed_at = now() where uid = auth.uid() and status = 'active';
end $$;

create or replace function public.goals_ready() returns boolean language sql stable as $$ select true $$;

revoke execute on function public.set_goal(text, text, boolean), public.reach_goal(text), public.drop_goal() from public, anon;
grant execute on function public.set_goal(text, text, boolean), public.reach_goal(text), public.drop_goal() to authenticated;
grant execute on function public.goal_open_to(text) to authenticated;
grant execute on function public.goals_ready() to anon, authenticated;
