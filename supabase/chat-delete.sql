-- Delete a chat (for you). Run after owner-club-deletion.sql. Additive: one new column and one
-- function; nothing the live app uses changes.
--
-- Deleting a direct conversation clears it from your Chats list and empties it on your side: the app
-- shows you only what was sent after cleared_at. The other person keeps their copy (a message is theirs
-- too), and if either of you writes again the conversation comes back with just the new messages.
-- Deleting also marks it read, so nothing you cleared counts as unread.
alter table public.conversation_reads add column if not exists cleared_at timestamptz;

create or replace function public.clear_conversation(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if not exists (select 1 from public.conversations where id = p_id and me in (user_a, user_b)) then
    raise exception 'That conversation isn''t available.' using errcode = 'P0001';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, read_at, cleared_at)
    values (p_id, me, now(), now())
    on conflict (conversation_id, user_id) do update set read_at = now(), cleared_at = now();
end $$;
revoke execute on function public.clear_conversation(text) from public, anon;
grant execute on function public.clear_conversation(text) to authenticated;

create or replace function public.chat_delete_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.chat_delete_ready() to authenticated;
