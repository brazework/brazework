-- Group chats: where a club talks, inside Forge. Three kinds, each tied to something already here,
-- so nobody sets up a server or a channel:
--   club  — one per club; every member is in it, and officers (moderator and up) can post announcements
--   event — one per event; everyone going is in it, plus the people hosting it
--   team  — small chats inside a club (a sub-team, a project), with members picked by the person who starts it
-- Ember (Forge's AI teammate) answers in any of them when someone asks it with @Ember; its replies are
-- marked as Ember's and keep the name of the person who asked.
-- Run after messages.sql, events.sql and club-events.sql. Additive only.
--
-- Who's in a chat follows Forge itself: join a club and you're in its chat; leave and you're out;
-- RSVP to an event and you're in its chat. One rule (can_read_chat) decides it everywhere.

create table public.chats (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('club', 'event', 'team')),
  community_id text references public.communities (id) on delete cascade,
  event_id text references public.events (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_body text not null default '',
  last_sender uuid,
  last_sender_name text not null default '',
  check (
    (kind = 'club' and community_id is not null and event_id is null)
    or (kind = 'event' and event_id is not null)
    or (kind = 'team' and community_id is not null and event_id is null and char_length(btrim(name)) between 1 and 60)
  )
);
create unique index chats_one_per_club on public.chats (community_id) where kind = 'club';
create unique index chats_one_per_event on public.chats (event_id) where kind = 'event';
create index chats_community_idx on public.chats (community_id);

-- Team chat members (club and event chats need none: membership comes from the club or the RSVP).
create table public.chat_members (
  chat_id text not null references public.chats (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (chat_id, uid)
);
create index chat_members_uid_idx on public.chat_members (uid);

create table public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  chat_id text not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_first text not null default '',
  sender_last text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  announcement boolean not null default false,
  ember boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

-- How far each person has read each chat: unread markers, and "seen by" on announcements.
create table public.chat_reads (
  chat_id text not null references public.chats (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (chat_id, uid)
);

-- ---------- The one rule ----------

create function public.can_read_chat(p_chat text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chats c
    where c.id = p_chat and (
      (c.kind = 'club' and public.my_rank(c.community_id) >= 1)
      or (c.kind = 'team' and public.my_rank(c.community_id) >= 1
          and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.uid = auth.uid()))
      or (c.kind = 'event' and (
          exists (select 1 from public.event_rsvps r where r.event_id = c.event_id and r.user_id = auth.uid())
          or exists (select 1 from public.events e where e.id = c.event_id and (
            (e.community_id is not null and public.my_rank(e.community_id) >= 3)
            or exists (select 1 from public.organization_admins a where a.org_id = e.org_id and a.uid = auth.uid()))))))
  )
$$;

-- ---------- Opening and starting chats ----------

-- A club's chat (members only). Every club gets one; this also makes it for clubs started before this file.
create function public.open_club_chat(p_community text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text;
begin
  if public.my_rank(p_community) < 1 then
    raise exception 'Join the club to see its chat.' using errcode = 'P0001';
  end if;
  insert into public.chats (kind, community_id) values ('club', p_community)
  on conflict (community_id) where kind = 'club' do nothing;
  select id into cid from public.chats where kind = 'club' and community_id = p_community;
  return cid;
end $$;

-- An event's chat: for people going, and the club officers or organization admins hosting it.
create function public.open_event_chat(p_event text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text; e public.events;
begin
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'That event wasn''t found.' using errcode = 'P0001'; end if;
  if not (
    exists (select 1 from public.event_rsvps r where r.event_id = p_event and r.user_id = auth.uid())
    or (e.community_id is not null and public.my_rank(e.community_id) >= 3)
    or exists (select 1 from public.organization_admins a where a.org_id = e.org_id and a.uid = auth.uid())
  ) then
    raise exception 'RSVP to join the event chat.' using errcode = 'P0001';
  end if;
  insert into public.chats (kind, event_id, community_id) values ('event', p_event, e.community_id)
  on conflict (event_id) where kind = 'event' do nothing;
  select id into cid from public.chats where kind = 'event' and event_id = p_event;
  return cid;
end $$;

-- A team chat inside a club, with the people you pick (all must be in the club; up to 50).
create function public.create_team_chat(p_community text, p_name text, p_members uuid[]) returns text
language plpgsql security definer set search_path = public as $$
declare cid text; n text := btrim(coalesce(p_name, ''));
begin
  if public.my_rank(p_community) < 1 then
    raise exception 'Join the club to start a team chat.' using errcode = 'P0001';
  end if;
  if char_length(n) < 1 or char_length(n) > 60 then
    raise exception 'Give the chat a name (up to 60 characters).' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_members, 1), 0) > 49 then
    raise exception 'Team chats can have up to 50 people.' using errcode = 'P0001';
  end if;
  insert into public.chats (kind, community_id, name, created_by) values ('team', p_community, n, auth.uid())
  returning id into cid;
  insert into public.chat_members (chat_id, uid, added_by)
  select cid, m.uid, auth.uid() from public.community_members m
  where m.community_id = p_community and (m.uid = auth.uid() or m.uid = any (coalesce(p_members, '{}')))
  on conflict do nothing;
  return cid;
end $$;

-- Add someone from the club to a team chat you're in.
create function public.add_chat_member(p_chat text, p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.chats;
begin
  select * into c from public.chats where id = p_chat;
  if c.id is null or c.kind <> 'team' or not public.can_read_chat(p_chat) then
    raise exception 'You can only add people to a team chat you''re in.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.community_members where community_id = c.community_id and uid = p_uid) then
    raise exception 'They need to be in the club first.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_members where chat_id = p_chat) >= 50 then
    raise exception 'Team chats can have up to 50 people.' using errcode = 'P0001';
  end if;
  insert into public.chat_members (chat_id, uid, added_by) values (p_chat, p_uid, auth.uid()) on conflict do nothing;
end $$;

-- Leave a team chat (club and event chats follow your club membership and RSVP instead).
create function public.leave_chat(p_chat text) returns void
language sql security definer set search_path = public as $$
  delete from public.chat_members m using public.chats c
  where c.id = p_chat and c.kind = 'team' and m.chat_id = c.id and m.uid = auth.uid()
$$;

create function public.mark_chat_read(p_chat text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_read_chat(p_chat) then return; end if;
  insert into public.chat_reads (chat_id, uid, read_at) values (p_chat, auth.uid(), now())
  on conflict (chat_id, uid) do update set read_at = excluded.read_at;
end $$;

-- ---------- Your chats, and who's seen an announcement ----------

-- Every chat you can read, newest activity first, with its title and whether it has unread messages.
-- Club chats for your clubs are made here if they don't exist yet, so the list is never missing one.
create function public.my_chats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  insert into public.chats (kind, community_id)
  select 'club', m.community_id from public.community_members m where m.uid = auth.uid()
  on conflict (community_id) where kind = 'club' do nothing;

  select coalesce(jsonb_agg(s.x order by s.sort desc), '[]'::jsonb) into out from (
    select jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'community_id', c.community_id, 'event_id', c.event_id,
      'title', case c.kind when 'club' then cm.name when 'event' then coalesce(e.title, 'Event') else c.name end,
      'subtitle', case c.kind when 'club' then 'Club chat' when 'event' then 'Event chat' else coalesce(cm.name, '') end,
      'lastAt', c.last_message_at, 'lastBody', c.last_body, 'lastSenderName', c.last_sender_name,
      'lastFromMe', c.last_sender = auth.uid(),
      'unread', c.last_message_at is not null and c.last_sender is distinct from auth.uid()
                and c.last_message_at > coalesce(r.read_at, 'epoch')
    ) as x, coalesce(c.last_message_at, c.created_at) as sort
    from public.chats c
    left join public.communities cm on cm.id = c.community_id
    left join public.events e on e.id = c.event_id
    left join public.chat_reads r on r.chat_id = c.id and r.uid = auth.uid()
    where public.can_read_chat(c.id)
    order by sort desc
    limit 100
  ) s;
  return out;
end $$;

create function public.unread_chats() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.chats c
  left join public.chat_reads r on r.chat_id = c.id and r.uid = auth.uid()
  where c.last_message_at is not null and c.last_sender is distinct from auth.uid()
    and c.last_message_at > coalesce(r.read_at, 'epoch') and public.can_read_chat(c.id)
$$;

-- For club officers: each announcement in the club's chat with how many members have seen it.
create function public.announcement_seen(p_chat text)
returns table (message_id text, seen integer, total integer)
language sql stable security definer set search_path = public as $$
  select m.id,
    (select count(*) from public.chat_reads r join public.community_members cm on cm.uid = r.uid and cm.community_id = c.community_id
      where r.chat_id = c.id and r.read_at >= m.created_at and r.uid <> m.sender_id)::int,
    greatest((select count(*) from public.community_members cm where cm.community_id = c.community_id) - 1, 0)::int
  from public.chats c join public.chat_messages m on m.chat_id = c.id and m.announcement
  where c.id = p_chat and c.kind = 'club' and public.my_rank(c.community_id) >= 3
  order by m.created_at desc limit 50
$$;

-- ---------- Messages ----------

-- Ember's reply in a chat, posted by the app for the person who asked it (shown as "Ember · asked by <name>").
create function public.post_ember_reply(p_chat text, p_body text) returns text
language plpgsql security definer set search_path = public as $$
declare mid text; b text := btrim(coalesce(p_body, ''));
begin
  if not public.can_read_chat(p_chat) then
    raise exception 'You''re not in this chat.' using errcode = 'P0001';
  end if;
  if char_length(b) < 1 then raise exception 'Ember had nothing to say.' using errcode = 'P0001'; end if;
  insert into public.chat_messages (chat_id, sender_id, body, ember) values (p_chat, auth.uid(), left(b, 2000), true)
  returning id into mid;
  return mid;
end $$;


-- The sender, their name and the time come from the database. Only club officers announce, and only in club chats.
create function public.chat_messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.chats; p public.profiles;
begin
  if auth.uid() is not null then new.sender_id := auth.uid(); new.created_at := now(); end if;
  select * into p from public.profiles where id = new.sender_id;
  new.sender_first := coalesce(p.first_name, ''); new.sender_last := coalesce(p.last_name, '');
  new.body := btrim(new.body);
  if new.ember then new.announcement := false; end if;
  if new.announcement then
    select * into c from public.chats where id = new.chat_id;
    if c.kind <> 'club' or public.my_rank(c.community_id) < 3 then
      raise exception 'Only club officers can post announcements.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger chat_messages_before_insert before insert on public.chat_messages
  for each row execute function public.chat_messages_before_insert();

create function public.chat_messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chats set last_message_at = new.created_at, last_body = left(new.body, 140),
    last_sender = new.sender_id, last_sender_name = new.sender_first
  where id = new.chat_id;
  insert into public.chat_reads (chat_id, uid, read_at) values (new.chat_id, new.sender_id, new.created_at)
  on conflict (chat_id, uid) do update set read_at = excluded.read_at;
  return null;
end $$;
create trigger chat_messages_after_insert after insert on public.chat_messages
  for each row execute function public.chat_messages_after_insert();

-- New clubs get their chat straight away.
create function public.communities_open_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.chats (kind, community_id) values ('club', new.id)
  on conflict (community_id) where kind = 'club' do nothing;
  return null;
end $$;
create trigger communities_open_chat after insert on public.communities
  for each row execute function public.communities_open_chat();

-- Every club that already exists gets its chat now.
insert into public.chats (kind, community_id) select 'club', id from public.communities
on conflict (community_id) where kind = 'club' do nothing;

-- ---------- Who can do what ----------
-- You see a chat, its members and its messages only if can_read_chat says you're in it. Messages go in
-- through the rules above and nobody can edit someone else's; you can delete your own. Chats themselves
-- are made only by the functions above. You only ever see your own read markers.

revoke all on public.chats, public.chat_members, public.chat_messages, public.chat_reads from anon, authenticated;

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

grant select on public.chats to authenticated;
create policy "chats you're in" on public.chats for select to authenticated using (public.can_read_chat(id));

grant select on public.chat_members to authenticated;
create policy "members of chats you're in" on public.chat_members for select to authenticated using (public.can_read_chat(chat_id));

grant select, delete on public.chat_messages to authenticated;
grant insert (chat_id, body, announcement) on public.chat_messages to authenticated;
create policy "read chats you're in" on public.chat_messages for select to authenticated using (public.can_read_chat(chat_id));
create policy "post in chats you're in" on public.chat_messages for insert to authenticated with check (public.can_read_chat(chat_id));
create policy "delete your own messages" on public.chat_messages for delete to authenticated using (sender_id = auth.uid());

grant select on public.chat_reads to authenticated;
create policy "your read markers" on public.chat_reads for select to authenticated using (uid = auth.uid());

revoke execute on function public.chat_messages_before_insert(), public.chat_messages_after_insert(),
  public.communities_open_chat() from anon, authenticated, public;
revoke execute on function public.can_read_chat(text), public.open_club_chat(text), public.open_event_chat(text),
  public.create_team_chat(text, text, uuid[]), public.add_chat_member(text, uuid), public.leave_chat(text),
  public.mark_chat_read(text), public.my_chats(), public.unread_chats(), public.announcement_seen(text),
  public.post_ember_reply(text, text) from anon, public;
grant execute on function public.can_read_chat(text), public.open_club_chat(text), public.open_event_chat(text),
  public.create_team_chat(text, text, uuid[]), public.add_chat_member(text, uuid), public.leave_chat(text),
  public.mark_chat_read(text), public.my_chats(), public.unread_chats(), public.announcement_seen(text),
  public.post_ember_reply(text, text) to authenticated;

alter publication supabase_realtime add table public.chats, public.chat_messages;
