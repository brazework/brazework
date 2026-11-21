-- Step 88: what Ember remembers (Linear FIX-233; founders, 2026-11-21, before the Product Hunt launch).
-- Run after linkedin-optional.sql. Additive and safe to re-run.
--
-- Things a member tells Ember that should carry over to the next chat: "I'm aiming for robotics
-- internships in Boston", "my manager is Dana Ruiz", "keep answers short". Ember only proposes one as a
-- card; it's saved when the member confirms. Each one is private: only the member reads it, only the
-- member saves or deletes it, nobody edits it in place. Settings lists every one with a Forget button;
-- "Download your data" includes them; deleting the account deletes them (profiles cascade).
create table if not exists public.ember_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists ember_memories_user_idx on public.ember_memories (user_id, created_at desc);
alter table public.ember_memories enable row level security;

drop policy if exists ember_memories_read on public.ember_memories;
create policy ember_memories_read on public.ember_memories for select to authenticated using (user_id = auth.uid());
drop policy if exists ember_memories_add on public.ember_memories;
create policy ember_memories_add on public.ember_memories for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ember_memories_forget on public.ember_memories;
create policy ember_memories_forget on public.ember_memories for delete to authenticated using (user_id = auth.uid());

-- At most 50 each: a memory is a short list, not a diary.
create or replace function public.ember_memories_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ember_memories where user_id = new.user_id) >= 50 then
    raise exception 'Ember remembers up to 50 things. Forget one in Settings first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists ember_memories_cap on public.ember_memories;
create trigger ember_memories_cap before insert on public.ember_memories for each row execute function public.ember_memories_cap();
revoke execute on function public.ember_memories_cap() from public, anon, authenticated;

revoke all on public.ember_memories from public, anon, authenticated;
grant select, insert, delete on public.ember_memories to authenticated;

create or replace function public.ember_memory_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
