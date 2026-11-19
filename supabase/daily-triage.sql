-- Step 67: daily triage of drafts on Today (docs/mcp-workflows.md, "Drafts"). Run after
-- mcp-workflows.sql. Additive and safe to re-run.
--
-- 1. One tap per draft. triage_tool_draft() decides a draft the way Today's buttons say:
--      keep  a post goes out as drafted; a milestone is logged on the project with no club, waiting
--            for proof (ask someone to sign it now or later).
--      club  the post goes to that club, or the milestone goes to that club's officers to verify.
--    It only sets where the draft goes, then hands it to approve_tool_draft(), so every check and
--    trigger from mcp-workflows.sql still runs as the member: your own draft, waiting, a club you're
--    in, posting pace, milestone limits, officers told. "Ask to sign" is keep, then request_vouch()
--    with all of vouches.sql's guards (the app does both). Dismiss is dismiss_tool_draft().
-- 2. A once-a-day reminder, off unless the member turns it on (Settings → Email, or on Today). It
--    follows the digest's rules: confirmed, onboarded members only; at most one a day, claimed before
--    sending so two runs can't both send; never when there's nothing new. "New" means a draft still
--    waiting that arrived since the last reminder (or in the last day). Only counts and tool names go
--    in the email, never what a draft says.

-- ---------- 1. Triage ----------
create or replace function public.triage_tool_draft(p_id uuid, p_action text, p_club text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.tool_drafts; club text;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  select * into d from public.tool_drafts where id = p_id and user_id = auth.uid() for update;
  if d.id is null then raise exception 'That draft isn''t yours.' using errcode = '42501'; end if;
  if d.status <> 'waiting' then raise exception 'That draft was already %.', d.status using errcode = 'P0001'; end if;
  if p_action = 'keep' then
    -- A post goes as drafted; a milestone stays on the project, waiting for proof.
    club := case when d.kind = 'post' then nullif(d.payload->>'club_id', '') else null end;
  elsif p_action = 'club' then
    club := coalesce(nullif(btrim(coalesce(p_club, '')), ''), nullif(d.payload->>'club_id', ''));
    if club is null then raise exception 'Pick one of your clubs.' using errcode = 'P0001'; end if;
  else
    raise exception 'Keep it, send it to a club, or dismiss it.' using errcode = 'P0001';
  end if;
  update public.tool_drafts set payload = jsonb_set(payload, '{club_id}', coalesce(to_jsonb(club), 'null'::jsonb)) where id = d.id;
  -- Checked again and made as the member, exactly as from /drafts (a club you're not in is refused here).
  return public.approve_tool_draft(d.id, null, null, null);
end $$;
revoke execute on function public.triage_tool_draft(uuid, text, text) from anon, public;
grant execute on function public.triage_tool_draft(uuid, text, text) to authenticated;

-- ---------- 2. The daily reminder ----------
alter table public.email_prefs add column if not exists daily_drafts boolean not null default false;

create or replace function public.save_draft_reminder(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  insert into public.email_prefs (user_id, daily_drafts) values (auth.uid(), coalesce(p_on, false))
  on conflict (user_id) do update set daily_drafts = excluded.daily_drafts, updated_at = now();
end $$;
revoke execute on function public.save_draft_reminder(boolean) from anon, public;
grant execute on function public.save_draft_reminder(boolean) to authenticated;

-- One row per member per (UTC) day the reminder went out.
create table if not exists public.draft_reminder_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.draft_reminder_sends enable row level security;
revoke all on public.draft_reminder_sends from anon, authenticated;

-- Who gets today's reminder, and what it counts. Paged by id. Service role only.
create or replace function public.draft_reminder_recipients(p_after uuid default null, p_limit int default 200)
returns table (user_id uuid, email text, first_name text, waiting int, fresh int, tools jsonb)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, u.email::text as email, p.first_name,
      greatest(coalesce((select max(s.sent_at) from public.draft_reminder_sends s where s.user_id = p.id), now() - interval '1 day'),
               now() - interval '7 days') as since
    from public.profiles p
    join auth.users u on u.id = p.id
    join public.email_prefs e on e.user_id = p.id and e.daily_drafts
    where p.onboarded and u.email_confirmed_at is not null and (p_after is null or p.id > p_after)
      and not exists (select 1 from public.draft_reminder_sends s where s.user_id = p.id and s.day = (now() at time zone 'utc')::date)
  ), x as (
    select b.id, b.email, b.first_name,
      (select count(*)::int from public.tool_drafts d where d.user_id = b.id and d.status = 'waiting') as waiting,
      (select count(*)::int from public.tool_drafts d where d.user_id = b.id and d.status = 'waiting' and d.created_at > b.since) as fresh,
      (select coalesce(jsonb_agg(jsonb_build_object('via', g.via, 'n', g.n) order by g.n desc, g.via), '[]')
         from (select d.via, count(*)::int as n from public.tool_drafts d
               where d.user_id = b.id and d.status = 'waiting' and d.created_at > b.since group by d.via) g) as tools
    from base b
  )
  select id, email, first_name, waiting, fresh, tools from x where fresh > 0
  order by id limit least(greatest(p_limit, 1), 500)
$$;
revoke execute on function public.draft_reminder_recipients(uuid, int) from anon, authenticated, public;
grant execute on function public.draft_reminder_recipients(uuid, int) to service_role;

-- Claim today's send before emailing (true when this run owns it); a failed send hands it back.
create or replace function public.claim_draft_reminder(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare claimed boolean := false;
begin
  insert into public.draft_reminder_sends (user_id, day) values (p_user, (now() at time zone 'utc')::date)
  on conflict do nothing returning true into claimed;
  return coalesce(claimed, false);
end $$;
create or replace function public.release_draft_reminder(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.draft_reminder_sends where user_id = p_user and day = (now() at time zone 'utc')::date
$$;
revoke execute on function public.claim_draft_reminder(uuid), public.release_draft_reminder(uuid) from anon, authenticated, public;
grant execute on function public.claim_draft_reminder(uuid), public.release_draft_reminder(uuid) to service_role;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.daily_triage_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.daily_triage_ready() to authenticated;
