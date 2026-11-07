-- Notifications and personal analytics. Run after schema.sql, messages.sql and events.sql.
--
-- Notifications are written only by the database (triggers on likes, comments, follows,
-- connections and community joins), so nobody can fake one. Each person can read,
-- mark as read and delete only their own.
--
-- Analytics: a profile view is recorded once per viewer, per profile, per day, and nobody can
-- read the raw rows (so you can't see who viewed you, and viewers can't be listed). The owner
-- gets totals from my_analytics().

-- ---------- Notifications ----------

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  actor_first text not null default '',
  actor_last text not null default '',
  kind text not null check (kind in ('like', 'comment', 'follow', 'connect_request', 'connect_accepted',
                                     'community_request', 'community_approved')),
  post_id text references public.posts (id) on delete cascade,
  comment_id text references public.comments (id) on delete cascade,
  community_id text references public.communities (id) on delete cascade,
  community_name text not null default '',
  snippet text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not read;
create index notifications_actor_idx on public.notifications (actor_id, kind);

-- Adds a notification for p_user about something p_actor did. Nothing happens for your own
-- actions or when you've blocked the person. Likes, follows and requests replace an earlier
-- one of the same kind, so liking and unliking doesn't pile them up.
create function public.notify(p_user uuid, p_actor uuid, p_kind text, p_post text default null,
                              p_comment text default null, p_cid text default null, p_snippet text default '')
returns void language plpgsql security definer set search_path = public as $$
declare a public.profiles;
begin
  if p_user is null or p_actor is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.message_blocks where blocker = p_user and blocked = p_actor) then return; end if;
  if p_kind <> 'comment' then
    delete from public.notifications
     where user_id = p_user and actor_id = p_actor and kind = p_kind
       and post_id is not distinct from p_post and community_id is not distinct from p_cid;
  end if;
  select * into a from public.profiles where id = p_actor;
  insert into public.notifications (user_id, actor_id, actor_first, actor_last, kind, post_id, comment_id,
                                    community_id, community_name, snippet)
  values (p_user, p_actor, coalesce(a.first_name, ''), coalesce(a.last_name, ''), p_kind, p_post, p_comment,
          p_cid, coalesce((select name from public.communities where id = p_cid), ''),
          left(regexp_replace(coalesce(p_snippet, ''), '\s+', ' ', 'g'), 140));
end $$;

-- Likes
create function public.likes_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  if tg_op = 'INSERT' then
    select * into p from public.posts where id = new.post_id;
    perform public.notify(p.author_id, new.user_id, 'like', p.id, null, p.community_id, p.body);
  else
    delete from public.notifications where kind = 'like' and actor_id = old.user_id and post_id = old.post_id;
  end if;
  return null;
end $$;
create trigger likes_notify after insert or delete on public.likes
  for each row execute function public.likes_notify();

-- Comments (deleting a comment removes its notification through comment_id)
create function public.comments_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  select * into p from public.posts where id = new.post_id;
  perform public.notify(p.author_id, new.author_id, 'comment', p.id, new.id, p.community_id, new.body);
  return null;
end $$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.comments_notify();

-- Follows
create function public.follows_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.target, new.follower, 'follow');
  else
    delete from public.notifications where kind = 'follow' and actor_id = old.follower and user_id = old.target;
  end if;
  return null;
end $$;
create trigger follows_notify after insert or delete on public.follows
  for each row execute function public.follows_notify();

-- Connections: a request notifies the other person; accepting notifies the sender and clears
-- the request; withdrawing, declining or removing clears both.
create function public.connections_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.to_id, new.from_id, 'connect_request');
  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status = 'pending' then
      delete from public.notifications where kind = 'connect_request' and user_id = new.to_id and actor_id = new.from_id;
      perform public.notify(new.from_id, new.to_id, 'connect_accepted');
    end if;
  else
    delete from public.notifications where kind in ('connect_request', 'connect_accepted')
      and ((user_id = old.to_id and actor_id = old.from_id) or (user_id = old.from_id and actor_id = old.to_id));
  end if;
  return null;
end $$;
create trigger connections_notify after insert or update or delete on public.connections
  for each row execute function public.connections_notify();

-- Community join requests notify the people who can approve them (helpers and above).
create function public.community_requests_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if tg_op = 'INSERT' then
    for m in select uid from public.community_members
              where community_id = new.community_id and public.role_rank(role) >= 2 loop
      perform public.notify(m.uid, new.uid, 'community_request', null, null, new.community_id);
    end loop;
  else
    delete from public.notifications where kind = 'community_request'
      and community_id = old.community_id and actor_id = old.uid;
  end if;
  return null;
end $$;
create trigger community_requests_notify after insert or delete on public.community_requests
  for each row execute function public.community_requests_notify();

-- Someone else adding you (approving your request) tells you that you're in.
create function public.community_members_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> new.uid then
    perform public.notify(new.uid, auth.uid(), 'community_approved', null, null, new.community_id);
  end if;
  return null;
end $$;
create trigger community_members_notify after insert on public.community_members
  for each row execute function public.community_members_notify();

create function public.unread_notifications() returns integer
language sql stable security invoker set search_path = public as $$
  select count(*)::integer from public.notifications where user_id = auth.uid() and not read
$$;

create function public.mark_notifications_read() returns void
language sql security invoker set search_path = public as $$
  update public.notifications set read = true where user_id = auth.uid() and not read
$$;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
create policy "your notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark yours read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clear yours" on public.notifications for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- ---------- Profile views ----------

create table public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer uuid not null references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  viewed_at timestamptz not null default now(),
  primary key (profile_id, viewer, day),
  check (profile_id <> viewer)
);
create index profile_views_time_idx on public.profile_views (profile_id, viewed_at);

alter table public.profile_views enable row level security;
revoke all on public.profile_views from anon, authenticated;
-- No policies and no grants: rows can only be added through record_profile_view() and read
-- as totals through my_analytics().

-- Counts a view of someone else's profile by a signed-in member with a confirmed email.
create function public.record_profile_view(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or me = p_profile then return; end if;
  if not exists (select 1 from auth.users where id = me and email_confirmed_at is not null) then return; end if;
  if not exists (select 1 from public.profiles where id = p_profile) then return; end if;
  insert into public.profile_views (profile_id, viewer) values (p_profile, me) on conflict do nothing;
end $$;

-- Your analytics for a range ('7d', '30d', '90d', '1y'), in your time zone. Each figure comes with
-- the same-length period just before it, for comparison.
create function public.my_analytics(p_range text, p_tz text default 'UTC') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  tz text := 'UTC';
  unit text; n integer; local_now timestamp; first_bucket timestamp;
  t_start timestamptz; t_now timestamptz := now(); p_start timestamptz;
  uniq integer; result jsonb;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_tz is not null and exists (select 1 from pg_timezone_names where name = p_tz) then tz := p_tz; end if;
  case p_range
    when '7d' then unit := 'day'; n := 7;
    when '30d' then unit := 'day'; n := 30;
    when '90d' then unit := 'week'; n := 13;
    when '1y' then unit := 'month'; n := 12;
    else raise exception 'Unknown range.' using errcode = '22023';
  end case;
  local_now := t_now at time zone tz;
  first_bucket := date_trunc(unit, local_now) - ((n - 1) || ' ' || unit)::interval;
  t_start := first_bucket at time zone tz;
  p_start := t_start - (t_now - t_start);

  select count(distinct viewer) into uniq from public.profile_views
   where profile_id = me and viewed_at >= t_start;

  with periods(k, a, b) as (values ('now', t_start, 'infinity'::timestamptz), ('before', p_start, t_start)),
  figures as (
    select k,
      (select count(*) from public.profile_views v where v.profile_id = me and v.viewed_at >= a and v.viewed_at < b) as views,
      (select count(distinct viewer) from public.profile_views v where v.profile_id = me and v.viewed_at >= a and v.viewed_at < b) as viewers,
      (select count(*) from public.likes l join public.posts p on p.id = l.post_id
        where p.author_id = me and l.user_id <> me and l.created_at >= a and l.created_at < b) as likes,
      (select count(*) from public.comments c join public.posts p on p.id = c.post_id
        where p.author_id = me and c.author_id <> me and c.created_at >= a and c.created_at < b) as comments,
      (select count(*) from public.follows f where f.target = me and f.created_at >= a and f.created_at < b) as followers,
      (select count(*) from public.connections c where me = any (c.users) and c.status = 'accepted'
        and c.accepted_at >= a and c.accepted_at < b) as connections
    from periods
  )
  select jsonb_build_object(
    'range', p_range, 'unit', unit, 'tz', tz, 'start', t_start, 'end', t_now,
    'current', (select to_jsonb(f) - 'k' from figures f where k = 'now'),
    'previous', (select to_jsonb(f) - 'k' from figures f where k = 'before'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', to_char(g, 'YYYY-MM-DD'), 'views', (
        select count(*) from public.profile_views v
         where v.profile_id = me and date_trunc(unit, v.viewed_at at time zone tz) = g
      )) order by g), '[]'::jsonb)
      from generate_series(first_bucket, date_trunc(unit, local_now), ('1 ' || unit)::interval) g
    ),
    -- Who viewed you, only as totals and only once at least 3 different people have, so it
    -- can't point to one person.
    'breakdown', case when uniq >= 3 then jsonb_build_object(
      'accountTypes', (select coalesce(jsonb_object_agg(account_type, c), '{}'::jsonb) from (
        select pr.account_type, count(*) c from (select distinct viewer from public.profile_views
          where profile_id = me and viewed_at >= t_start) v
        join public.profiles pr on pr.id = v.viewer group by pr.account_type) x),
      'fields', (select coalesce(jsonb_agg(jsonb_build_object('field', field, 'count', c) order by c desc, field), '[]'::jsonb) from (
        select pr.field, count(*) c from (select distinct viewer from public.profile_views
          where profile_id = me and viewed_at >= t_start) v
        join public.profiles pr on pr.id = v.viewer where pr.field <> '' group by pr.field
        having count(*) >= 2 order by c desc limit 3) x)
    ) else null end,
    'topPosts', (select coalesce(jsonb_agg(to_jsonb(y) - 'score' order by y.score desc, y.created_at desc), '[]'::jsonb) from (
      select x.*, x.likes + x.comments as score from (
        select p.id, left(p.body, 140) as body, p.created_at, p.community_name as "communityName",
          (select count(*) from public.likes l where l.post_id = p.id and l.user_id <> me and l.created_at >= t_start) as likes,
          (select count(*) from public.comments c where c.post_id = p.id and c.author_id <> me and c.created_at >= t_start) as comments
        from public.posts p where p.author_id = me
      ) x where x.likes + x.comments > 0 order by score desc, x.created_at desc limit 3
    ) y)
  ) into result;
  return result;
end $$;

-- Internal functions aren't part of the site's API.
revoke execute on function public.notify(uuid, uuid, text, text, text, text, text), public.likes_notify(),
  public.comments_notify(), public.follows_notify(), public.connections_notify(),
  public.community_requests_notify(), public.community_members_notify()
  from anon, authenticated, public;
revoke execute on function public.unread_notifications(), public.mark_notifications_read(),
  public.record_profile_view(uuid), public.my_analytics(text, text) from anon, public;
grant execute on function public.unread_notifications(), public.mark_notifications_read(),
  public.record_profile_view(uuid), public.my_analytics(text, text) to authenticated;
