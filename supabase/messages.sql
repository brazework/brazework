-- Forge messages: one-to-one conversations between members.
-- Run after schema.sql (paste into the SQL editor and click Run).
-- Connections message each other straight into the Inbox. Anyone else starts as a request,
-- which the other person accepts or declines; until then the sender can send up to 3 messages.

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
  a_read_at timestamptz not null default 'epoch',
  b_read_at timestamptz not null default 'epoch',
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

-- Opens your conversation with someone, starting one if needed. Returns its id.
create function public.start_conversation(p_other uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; cid text; connected boolean;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_other is null or p_other = me or not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'That member can''t be messaged.' using errcode = '22023';
  end if;
  a := least(me, p_other); b := greatest(me, p_other);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is not null then return cid; end if;
  connected := exists (select 1 from public.connections
    where status = 'accepted' and least(from_id, to_id) = a and greatest(from_id, to_id) = b);
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

-- Marks a conversation as read up to now, for you only.
create function public.mark_conversation_read(p_cid text) returns void
language sql security definer set search_path = public as $$
  update public.conversations set
    a_read_at = case when user_a = auth.uid() then now() else a_read_at end,
    b_read_at = case when user_b = auth.uid() then now() else b_read_at end
  where id = p_cid and auth.uid() in (user_a, user_b)
$$;

-- How many of your conversations have messages you haven't read (requests included).
create function public.unread_conversations() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.conversations
  where last_message_at is not null and last_sender is distinct from auth.uid()
    and ((user_a = auth.uid() and last_message_at > a_read_at)
      or (user_b = auth.uid() and last_message_at > b_read_at))
$$;

-- New messages: the sender and time come from the database; a pending request allows 3 messages.
create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  if auth.uid() is not null then new.sender_id := auth.uid(); new.created_at := now(); end if;
  select * into c from public.conversations where id = new.conversation_id;
  if c.status = 'request' then
    if new.sender_id <> c.started_by then
      raise exception 'Accept this message request to reply.' using errcode = '42501';
    end if;
    if (select count(*) from public.messages where conversation_id = c.id) >= 3 then
      raise exception 'You can send up to 3 messages until they accept your request.' using errcode = 'P0001';
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
    last_message_at = new.created_at, last_body = left(new.body, 140), last_sender = new.sender_id,
    a_read_at = case when user_a = new.sender_id then new.created_at else a_read_at end,
    b_read_at = case when user_b = new.sender_id then new.created_at else b_read_at end
  where id = new.conversation_id;
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

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

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

revoke execute on function public.messages_before_insert(), public.messages_after_insert(),
  public.connections_open_conversation() from anon, authenticated, public;
revoke execute on function public.start_conversation(uuid), public.accept_conversation(text),
  public.mark_conversation_read(text), public.unread_conversations() from anon, public;
grant execute on function public.start_conversation(uuid), public.accept_conversation(text),
  public.mark_conversation_read(text), public.unread_conversations() to authenticated;

alter publication supabase_realtime add table public.conversations, public.messages;
