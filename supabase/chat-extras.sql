-- Reactions, replies and unsend for direct messages and group chats. Run after mcp.sql. Additive.
--
-- Reactions: one of eight emoji per person per message (toggle on and off); only people in the
-- conversation or chat can see or add them. Replies: a message can point at an earlier message in
-- the same conversation or chat (anything else is dropped). Unsend: you can delete your own direct
-- message within 15 minutes (group chat messages could already be deleted by their sender); the
-- conversation's preview falls back to the message before it.

-- ---------- Replies ----------
alter table public.messages add column reply_to text references public.messages (id) on delete set null;
alter table public.chat_messages add column reply_to text references public.chat_messages (id) on delete set null;
grant insert (reply_to) on public.messages to authenticated;
grant insert (reply_to) on public.chat_messages to authenticated;

create function public.messages_reply_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to is not null and not exists (select 1 from public.messages m where m.id = new.reply_to and m.conversation_id = new.conversation_id) then
    new.reply_to := null;
  end if;
  return new;
end $$;
create trigger messages_reply_check before insert on public.messages for each row execute function public.messages_reply_check();

create function public.chat_messages_reply_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to is not null and not exists (select 1 from public.chat_messages m where m.id = new.reply_to and m.chat_id = new.chat_id) then
    new.reply_to := null;
  end if;
  return new;
end $$;
create trigger chat_messages_reply_check before insert on public.chat_messages for each row execute function public.chat_messages_reply_check();

-- ---------- Unsend (direct messages) ----------
grant delete on public.messages to authenticated;
create policy "unsend within 15 minutes" on public.messages for delete to authenticated
  using (sender_id = auth.uid() and created_at > now() - interval '15 minutes');

create function public.messages_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  select * into m from public.messages where conversation_id = old.conversation_id order by created_at desc limit 1;
  update public.conversations set last_message_at = m.created_at, last_body = coalesce(left(m.body, 140), ''), last_sender = m.sender_id
   where id = old.conversation_id;
  return null;
end $$;
create trigger messages_after_delete after delete on public.messages for each row execute function public.messages_after_delete();

create function public.chat_messages_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.chat_messages;
begin
  select * into m from public.chat_messages where chat_id = old.chat_id order by created_at desc limit 1;
  update public.chats set last_message_at = m.created_at, last_body = coalesce(left(m.body, 140), ''), last_sender = m.sender_id, last_sender_name = coalesce(m.sender_first, '')
   where id = old.chat_id;
  return null;
end $$;
create trigger chat_messages_after_delete after delete on public.chat_messages for each row execute function public.chat_messages_after_delete();

-- ---------- Reactions ----------
create function public.reaction_ok(e text) returns boolean language sql immutable as $$
  select e in ('👍', '❤️', '😂', '🎉', '🔥', '👀', '🚀', '💡')
$$;

create table public.message_reactions (
  message_id text not null references public.messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (public.reaction_ok(emoji)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create table public.chat_message_reactions (
  message_id text not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (public.reaction_ok(emoji)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create function public.can_read_message(p_message text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                  where m.id = p_message and auth.uid() in (c.user_a, c.user_b))
$$;
create function public.can_read_chat_message(p_message text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_messages m where m.id = p_message and public.can_read_chat(m.chat_id))
$$;

alter table public.message_reactions enable row level security;
alter table public.chat_message_reactions enable row level security;
create policy "read reactions in your conversations" on public.message_reactions for select to authenticated using (public.can_read_message(message_id));
create policy "react in your conversations" on public.message_reactions for insert to authenticated with check (user_id = auth.uid() and public.can_read_message(message_id));
create policy "remove your reactions" on public.message_reactions for delete to authenticated using (user_id = auth.uid());
create policy "read reactions in your chats" on public.chat_message_reactions for select to authenticated using (public.can_read_chat_message(message_id));
create policy "react in your chats" on public.chat_message_reactions for insert to authenticated with check (user_id = auth.uid() and public.can_read_chat_message(message_id));
create policy "remove your chat reactions" on public.chat_message_reactions for delete to authenticated using (user_id = auth.uid());

revoke all on public.message_reactions, public.chat_message_reactions from anon, authenticated;
grant select, delete on public.message_reactions, public.chat_message_reactions to authenticated;
grant insert (message_id, emoji) on public.message_reactions, public.chat_message_reactions to authenticated;
revoke execute on function public.messages_reply_check(), public.chat_messages_reply_check(), public.messages_after_delete(),
  public.chat_messages_after_delete() from anon, authenticated, public;

-- Live updates, where Realtime is set up (Supabase projects have this publication).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.message_reactions, public.chat_message_reactions;
  end if;
end $$;
