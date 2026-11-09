-- Ember chats you can come back to, and answer ratings. Run after mentions.sql. Additive.
--
-- copilot_chats: each member's own conversations with Ember. Private: only the member can read,
-- rename or delete them (no one else, not club officers, not other members). Drafts Ember
-- prepared are kept only as a label ("Drafted: a post"), never as a card that could be confirmed
-- twice. Chats untouched for 180 days are deleted (the app clears them when you save a chat, and
-- copilot_chats_expire() can be scheduled to do it for everyone).
--
-- copilot_ratings: thumbs up or down on one answer, sent by the member on purpose to help improve
-- Ember. It holds only the question and answer they rated (not the rest of the chat). Members can
-- read and remove their own ratings; the Forge team reads them with the service role.

create table public.copilot_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  messages jsonb not null default '[]'
    check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 80 and pg_column_size(messages) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index copilot_chats_user_idx on public.copilot_chats (user_id, updated_at desc);

create function public.copilot_chats_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; new.created_at := old.created_at;
  else new.created_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
create trigger copilot_chats_stamp before insert or update on public.copilot_chats
  for each row execute function public.copilot_chats_stamp();

alter table public.copilot_chats enable row level security;
create policy "own chats: read" on public.copilot_chats for select to authenticated using (user_id = auth.uid());
create policy "own chats: add" on public.copilot_chats for insert to authenticated with check (user_id = auth.uid());
create policy "own chats: change" on public.copilot_chats for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chats: delete" on public.copilot_chats for delete to authenticated using (user_id = auth.uid());
revoke all on public.copilot_chats from anon, authenticated;
grant select, delete on public.copilot_chats to authenticated;
grant insert (title, messages), update (title, messages) on public.copilot_chats to authenticated;

-- For a scheduled job (service role): delete everyone's chats untouched for 180 days.
create function public.copilot_chats_expire() returns integer
language sql security definer set search_path = public as $$
  with gone as (delete from public.copilot_chats where updated_at < now() - interval '180 days' returning 1)
  select count(*)::int from gone
$$;
revoke execute on function public.copilot_chats_expire(), public.copilot_chats_stamp() from anon, authenticated, public;

create table public.copilot_ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  reason text not null default '' check (char_length(reason) <= 500),
  question text not null default '' check (char_length(question) <= 2000),
  answer text not null default '' check (char_length(answer) <= 6000),
  tools text[] not null default '{}' check (cardinality(tools) <= 20),
  created_at timestamptz not null default now()
);
create index copilot_ratings_recent_idx on public.copilot_ratings (created_at desc);

create function public.copilot_ratings_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  new.created_at := now();
  return new;
end $$;
create trigger copilot_ratings_stamp before insert on public.copilot_ratings
  for each row execute function public.copilot_ratings_stamp();
revoke execute on function public.copilot_ratings_stamp() from anon, authenticated, public;

alter table public.copilot_ratings enable row level security;
create policy "own ratings: read" on public.copilot_ratings for select to authenticated using (user_id = auth.uid());
create policy "own ratings: add" on public.copilot_ratings for insert to authenticated with check (user_id = auth.uid());
create policy "own ratings: delete" on public.copilot_ratings for delete to authenticated using (user_id = auth.uid());
revoke all on public.copilot_ratings from anon, authenticated;
grant select, delete on public.copilot_ratings to authenticated;
grant insert (rating, reason, question, answer, tools) on public.copilot_ratings to authenticated;
