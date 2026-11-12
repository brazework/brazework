-- Email alerts (Linear FIX-18): new messages, connection requests and comments on your posts reach
-- your inbox when you haven't seen them in the app. Batched: the hourly job sends at most one email a
-- run per member, only for what arrived since the last one and is still unread after 10 minutes. Each
-- kind has its own switch in Settings → Email (on by default). Run after mcp-milestones.sql. Additive.

alter table public.email_prefs
  add column alert_messages boolean not null default true,
  add column alert_requests boolean not null default true,
  add column alert_comments boolean not null default true;

create function public.save_email_alerts(p_messages boolean, p_requests boolean, p_comments boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  insert into public.email_prefs (user_id, alert_messages, alert_requests, alert_comments)
  values (auth.uid(), coalesce(p_messages, true), coalesce(p_requests, true), coalesce(p_comments, true))
  on conflict (user_id) do update set alert_messages = excluded.alert_messages, alert_requests = excluded.alert_requests,
    alert_comments = excluded.alert_comments, updated_at = now();
end $$;
revoke execute on function public.save_email_alerts(boolean, boolean, boolean) from anon, public;
grant execute on function public.save_email_alerts(boolean, boolean, boolean) to authenticated;

-- How far each member's alerts have gone: everything up to `through` has been emailed (or was quiet).
create table public.alert_sends (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  through timestamptz not null,
  sent_at timestamptz not null default now()
);
alter table public.alert_sends enable row level security;
revoke all on public.alert_sends from anon, authenticated;

-- Who gets an alert this run, and what it says. The window is (since, p_until]: since is the last
-- alert, at most a day back (so switching a kind back on never sends a pile of old news). Only unread
-- things count, from people you haven't blocked. Paged by id. Service role only.
create function public.email_alert_recipients(p_until timestamptz, p_after uuid default null, p_limit int default 200)
returns table (user_id uuid, email text, first_name text, since timestamptz, messages jsonb, requests jsonb, comments jsonb)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, u.email::text as email, p.first_name,
      greatest(coalesce(a.through, p_until - interval '1 hour'), p_until - interval '1 day') as since,
      coalesce(e.alert_messages, true) as want_m, coalesce(e.alert_requests, true) as want_r, coalesce(e.alert_comments, true) as want_c
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.email_prefs e on e.user_id = p.id
    left join public.alert_sends a on a.user_id = p.id
    where p.onboarded and u.email_confirmed_at is not null and (p_after is null or p.id > p_after)
  ), x as (
    select b.id, b.email, b.first_name, b.since,
      case when b.want_m then (
        select jsonb_agg(jsonb_build_object('from', trim(o.first_name || ' ' || o.last_name), 'n', m.n) order by m.latest desc)
        from (
          select case when c.user_a = b.id then c.user_b else c.user_a end as other, count(*) as n, max(msg.created_at) as latest
          from public.conversations c
          join public.messages msg on msg.conversation_id = c.id
          left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = b.id
          where b.id in (c.user_a, c.user_b) and msg.sender_id <> b.id
            and msg.created_at > b.since and msg.created_at <= p_until
            and msg.created_at > coalesce(r.read_at, 'epoch')
          group by 1
        ) m
        join public.profiles o on o.id = m.other
        where not exists (select 1 from public.message_blocks k where k.blocker = b.id and k.blocked = m.other)
      ) end as messages,
      case when b.want_r then (
        select jsonb_agg(trim(n.actor_first || ' ' || n.actor_last) order by n.created_at desc)
        from public.notifications n
        where n.user_id = b.id and n.kind = 'connect_request' and not n.read
          and n.created_at > b.since and n.created_at <= p_until
          and not exists (select 1 from public.message_blocks k where k.blocker = b.id and k.blocked = n.actor_id)
      ) end as requests,
      case when b.want_c then (
        select jsonb_agg(jsonb_build_object('from', g.name, 'n', g.n) order by g.latest desc)
        from (
          select n.actor_id, trim(min(n.actor_first) || ' ' || min(n.actor_last)) as name, count(*) as n, max(n.created_at) as latest
          from public.notifications n
          where n.user_id = b.id and n.kind = 'comment' and not n.read
            and n.created_at > b.since and n.created_at <= p_until
            and not exists (select 1 from public.message_blocks k where k.blocker = b.id and k.blocked = n.actor_id)
          group by n.actor_id
        ) g
      ) end as comments
    from base b
    where b.want_m or b.want_r or b.want_c
  )
  select id, email, first_name, since, messages, requests, comments from x
  where messages is not null or requests is not null or comments is not null
  order by id limit least(greatest(p_limit, 1), 500)
$$;
revoke execute on function public.email_alert_recipients(timestamptz, uuid, int) from anon, authenticated, public;
grant execute on function public.email_alert_recipients(timestamptz, uuid, int) to service_role;

-- Claim a member's alert before sending, so two runs at once can't both email them: it moves `through`
-- forward only if nobody else has since `p_since`. Returns true when this run owns the send.
create function public.claim_email_alert(p_user uuid, p_since timestamptz, p_until timestamptz) returns boolean
language plpgsql security definer set search_path = public as $$
declare claimed boolean := false;
begin
  insert into public.alert_sends (user_id, through) values (p_user, p_until)
  on conflict (user_id) do update set through = excluded.through, sent_at = now()
    where public.alert_sends.through <= p_since
  returning true into claimed;
  return coalesce(claimed, false);
end $$;

-- A send that failed hands the window back, so the next run tries again.
create function public.release_email_alert(p_user uuid, p_since timestamptz, p_until timestamptz) returns void
language sql security definer set search_path = public as $$
  update public.alert_sends set through = p_since where user_id = p_user and through = p_until
$$;
revoke execute on function public.claim_email_alert(uuid, timestamptz, timestamptz),
  public.release_email_alert(uuid, timestamptz, timestamptz) from anon, authenticated, public;
grant execute on function public.claim_email_alert(uuid, timestamptz, timestamptz),
  public.release_email_alert(uuid, timestamptz, timestamptz) to service_role;
