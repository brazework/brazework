-- Forge messages: one-to-one conversations between members.
-- Run after schema.sql (paste into the SQL editor and click Run).
-- Connections message each other straight into the Inbox. Anyone else starts as a request: one message,
-- which the other person accepts, declines, or blocks and reports. Each member chooses who can send them
-- a request. Read markers are private, so a sender never learns whether a request was read.

create table public.conversations (
  id text primary key default gen_random_uuid()::text,
  -- The two people, stored in a fixed order so there's only ever one conversation per pair.
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  started_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'request')),
  people jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  last_body text not null default '',
  last_sender uuid,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index conversations_a_idx on public.conversations (user_a, last_message_at desc);
create index conversations_b_idx on public.conversations (user_b, last_message_at desc);

create table public.messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- When each person last read a conversation. It lives apart from the conversation so that reading
-- never touches the row (or sends a live update to) the other person.
create table public.conversation_reads (
  conversation_id text not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_reads_user_idx on public.conversation_reads (user_id);

-- Your messaging choices. No row means the defaults.
-- requests_on: whether requests wait in a separate Requests tab, or show in your Inbox marked "Not connected".
-- who_can_message: who can send you a request. Connections can always message you.
create table public.message_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  requests_on boolean not null default true,
  who_can_message text not null default 'everyone' check (who_can_message in ('everyone', 'communities', 'connections')),
  updated_at timestamptz not null default now()
);

create table public.message_blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index message_blocks_blocked_idx on public.message_blocks (blocked);

-- Reports keep a copy of the messages, since blocking removes the conversation.
-- Nobody can read these from the site; review them in the Supabase dashboard.
create table public.message_reports (
  id text primary key default gen_random_uuid()::text,
  reporter uuid references public.profiles (id) on delete set null,
  reported uuid references public.profiles (id) on delete set null,
  conversation_id text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index message_reports_reporter_idx on public.message_reports (reporter);
create index message_reports_reported_idx on public.message_reports (reported);

-- Internal: stops messages between two people if either has blocked the other. Someone who was blocked
-- gets the same wording as a closed setting, so they can't tell they were blocked.
create function public.message_block_check(p_me uuid, p_other uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.message_blocks where blocker = p_other and blocked = p_me) then
    raise exception 'This member isn''t accepting messages from you right now.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.message_blocks where blocker = p_me and blocked = p_other) then
    raise exception 'You''ve blocked this member. Unblock them in Settings to message them.' using errcode = 'P0001';
  end if;
end $$;

-- Internal: does p_to's "who can message you" setting let a non-connection send them a request?
create function public.can_request_message(p_from uuid, p_to uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case coalesce((select who_can_message from public.message_settings where user_id = p_to), 'everyone')
    when 'everyone' then true
    when 'communities' then exists (select 1 from public.community_members x
      join public.community_members y on y.community_id = x.community_id
      where x.uid = p_from and y.uid = p_to)
    else false end
$$;

-- Opens your conversation with someone, starting one if needed. Returns its id.
create function public.start_conversation(p_other uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; cid text; connected boolean;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_other is null or p_other = me or not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'That member can''t be messaged.' using errcode = '22023';
  end if;
  perform public.message_block_check(me, p_other);
  a := least(me, p_other); b := greatest(me, p_other);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is not null then return cid; end if;
  connected := exists (select 1 from public.connections
    where status = 'accepted' and least(from_id, to_id) = a and greatest(from_id, to_id) = b);
  if not connected and not public.can_request_message(me, p_other) then
    raise exception 'This member isn''t accepting messages from you right now.' using errcode = 'P0001';
  end if;
  insert into public.conversations (user_a, user_b, started_by, status, people)
  values (a, b, me, case when connected then 'active' else 'request' end,
          jsonb_build_object(a::text, coalesce(public.person_info(a), '{}'::jsonb),
                             b::text, coalesce(public.person_info(b), '{}'::jsonb)))
  on conflict (user_a, user_b) do nothing
  returning id into cid;
  if cid is null then select id into cid from public.conversations where user_a = a and user_b = b; end if;
  return cid;
end $$;

-- The person who received a request accepts it.
create function public.accept_conversation(p_cid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set status = 'active'
  where id = p_cid and status = 'request' and started_by <> auth.uid()
    and auth.uid() in (user_a, user_b);
  if not found then raise exception 'You don''t have permission to do that.' using errcode = '42501'; end if;
end $$;

-- The person who received a request blocks the sender and reports it. The conversation is removed.
create function public.block_and_report(p_cid text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.conversations; other uuid;
begin
  select * into c from public.conversations
    where id = p_cid and status = 'request' and started_by <> me and me in (user_a, user_b) for update;
  if c.id is null then raise exception 'You don''t have permission to do that.' using errcode = '42501'; end if;
  other := c.started_by;
  insert into public.message_blocks (blocker, blocked) values (me, other) on conflict do nothing;
  insert into public.message_reports (reporter, reported, conversation_id, messages)
  values (me, other, c.id, coalesce((select jsonb_agg(jsonb_build_object('sender', sender_id, 'body', body, 'at', created_at) order by created_at)
    from public.messages where conversation_id = c.id), '[]'::jsonb));
  delete from public.conversations where id = c.id;
end $$;

-- Saves your messaging choices.
create function public.save_message_settings(p_requests_on boolean, p_who text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into public.message_settings (user_id, requests_on, who_can_message)
  values (auth.uid(), p_requests_on, p_who)
  on conflict (user_id) do update set requests_on = excluded.requests_on,
    who_can_message = excluded.who_can_message, updated_at = now();
end $$;

-- Marks a conversation as read up to now, for you only.
create function public.mark_conversation_read(p_cid text) returns void
language sql security definer set search_path = public as $$
  insert into public.conversation_reads (conversation_id, user_id, read_at)
  select id, auth.uid(), now() from public.conversations
  where id = p_cid and auth.uid() in (user_a, user_b)
  on conflict (conversation_id, user_id) do update set read_at = excluded.read_at
$$;

-- How many of your conversations have messages you haven't read (requests included).
create function public.unread_conversations() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.conversations c
  left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
  where auth.uid() in (c.user_a, c.user_b) and c.last_message_at is not null
    and c.last_sender is distinct from auth.uid()
    and c.last_message_at > coalesce(r.read_at, 'epoch')
$$;

-- New messages: the sender and time come from the database. Blocks stop any message. A pending request
-- allows one message from the person who started it, if the other person's setting still allows it.
-- Locking the conversation means two messages sent at once can't both count as the first.
create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations; other uuid;
begin
  if auth.uid() is not null then new.sender_id := auth.uid(); new.created_at := now(); end if;
  select * into c from public.conversations where id = new.conversation_id for update;
  if c.id is null or new.sender_id not in (c.user_a, c.user_b) then return new; end if; -- refused by the rules below
  other := case when new.sender_id = c.user_a then c.user_b else c.user_a end;
  perform public.message_block_check(new.sender_id, other);
  if c.status = 'request' then
    if new.sender_id <> c.started_by then
      raise exception 'Accept this message request to reply.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.messages where conversation_id = c.id) then
      raise exception 'You can send one message until they accept your request.' using errcode = 'P0001';
    end if;
    if not public.can_request_message(new.sender_id, other) then
      raise exception 'This member isn''t accepting messages from you right now.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- Each message updates its conversation's preview, and counts as read for the sender.
create function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set
    last_message_at = new.created_at, last_body = left(new.body, 140), last_sender = new.sender_id
  where id = new.conversation_id;
  insert into public.conversation_reads (conversation_id, user_id, read_at)
  values (new.conversation_id, new.sender_id, new.created_at)
  on conflict (conversation_id, user_id) do update set read_at = excluded.read_at;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Becoming connected turns a pending request into a normal conversation.
create function public.connections_open_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' then
    update public.conversations set status = 'active'
    where user_a = least(new.from_id, new.to_id) and user_b = greatest(new.from_id, new.to_id) and status = 'request';
  end if;
  return null;
end $$;
create trigger connections_open_conversation after insert or update of status on public.connections
  for each row execute function public.connections_open_conversation();

-- ---------- Who can do what ----------
-- Only the two people in a conversation can see it. Messages go in only through the rules above;
-- nobody can edit someone else's. The person who received a request can decline it (it's removed).
-- You only ever see your own read markers, settings and blocks. Reports can't be read from the site.

-- Supabase grants full table permissions on new tables by default; start from none.
revoke all on public.conversations, public.messages, public.conversation_reads,
  public.message_settings, public.message_blocks, public.message_reports from anon, authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.message_settings enable row level security;
alter table public.message_blocks enable row level security;
alter table public.message_reports enable row level security;

grant select, delete on public.conversations to authenticated;
create policy "your conversations" on public.conversations for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "decline requests" on public.conversations for delete to authenticated
  using (status = 'request' and started_by <> auth.uid() and auth.uid() in (user_a, user_b));

grant select on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;
create policy "read your messages" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
create policy "send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
      and (c.status = 'active' or c.started_by = auth.uid())));

grant select on public.conversation_reads to authenticated;
create policy "your read markers" on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());

grant select on public.message_settings to authenticated;
create policy "your message settings" on public.message_settings for select to authenticated
  using (user_id = auth.uid());

grant select, delete on public.message_blocks to authenticated;
create policy "people you blocked" on public.message_blocks for select to authenticated
  using (blocker = auth.uid());
create policy "unblock" on public.message_blocks for delete to authenticated
  using (blocker = auth.uid());

revoke execute on function public.messages_before_insert(), public.messages_after_insert(),
  public.connections_open_conversation(), public.message_block_check(uuid, uuid),
  public.can_request_message(uuid, uuid) from anon, authenticated, public;
revoke execute on function public.start_conversation(uuid), public.accept_conversation(text),
  public.block_and_report(text), public.save_message_settings(boolean, text),
  public.mark_conversation_read(text), public.unread_conversations() from anon, public;
grant execute on function public.start_conversation(uuid), public.accept_conversation(text),
  public.block_and_report(text), public.save_message_settings(boolean, text),
  public.mark_conversation_read(text), public.unread_conversations() to authenticated;

alter publication supabase_realtime add table public.conversations, public.messages, public.conversation_reads;
