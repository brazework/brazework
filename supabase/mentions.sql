-- @mentions in posts: type @ in the composer, pick a member, and they get a notification
-- ("Maya mentioned you in a post"). Run after club-profile.sql. Additive: existing posts keep
-- an empty mentions list.
--
-- The database decides who was mentioned, not the browser: on insert, posts.mentions is cut down
-- to real profiles whose current "@First Last" appears in the post's text (at most 10), with the
-- name taken from their profile. Only people who can read the post are notified (anyone for the
-- main feed and public clubs; members for private clubs; never banned members), and a post held
-- for review notifies when a moderator publishes it. notify() already skips yourself and anyone
-- who blocked you.

alter table public.posts add column mentions jsonb not null default '[]'
  check (jsonb_typeof(mentions) = 'array' and jsonb_array_length(mentions) <= 10);
grant insert (mentions) on public.posts to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'like', 'comment', 'follow', 'connect_request', 'connect_accepted', 'community_request', 'community_approved',
  'milestone_request', 'milestone_verified', 'milestone_declined', 'mention'));

-- Keep only real, named, distinct mentions, with names from the profiles themselves.
create function public.posts_clean_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.mentions := coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.pos)
      from (
        select distinct on (p.id) p.id, trim(p.first_name || ' ' || p.last_name) as name, e.pos
          from jsonb_array_elements(case when jsonb_typeof(new.mentions) = 'array' then new.mentions else '[]' end)
               with ordinality as e(item, pos)
          join public.profiles p
            on e.item ->> 'id' ~ '^[0-9a-fA-F-]{36}$' and p.id = (e.item ->> 'id')::uuid
         where trim(p.first_name || ' ' || p.last_name) <> ''
           and position('@' || trim(p.first_name || ' ' || p.last_name) in new.body) > 0
         order by p.id, e.pos
      ) m
     where m.pos <= 20), '[]');
  if jsonb_array_length(new.mentions) > 10 then
    new.mentions := (select jsonb_agg(x) from (select x from jsonb_array_elements(new.mentions) x limit 10) s);
  end if;
  return new;
end $$;
create trigger posts_clean_mentions before insert on public.posts
  for each row execute function public.posts_clean_mentions();

-- Notify everyone mentioned who can read the post.
create function public.notify_mentions(p public.posts) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb; who uuid;
begin
  if p.status <> 'visible' then return; end if;
  for m in select * from jsonb_array_elements(p.mentions) loop
    who := (m ->> 'id')::uuid;
    if p.community_id is not null and (
         public.is_banned(p.community_id, who)
         or not (exists (select 1 from public.communities where id = p.community_id and privacy = 'public')
                 or exists (select 1 from public.community_members where community_id = p.community_id and uid = who)))
    then continue; end if;
    perform public.notify(who, p.author_id, 'mention', p.id, null, p.community_id, p.body);
  end loop;
end $$;

create function public.posts_mentions_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (old.status = 'held' and new.status = 'visible') then
    perform public.notify_mentions(new);
  end if;
  return null;
end $$;
create trigger posts_mentions_notify after insert or update of status on public.posts
  for each row execute function public.posts_mentions_notify();

revoke execute on function public.posts_clean_mentions(), public.notify_mentions(public.posts),
  public.posts_mentions_notify() from anon, authenticated, public;
