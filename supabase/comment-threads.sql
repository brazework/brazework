-- Step 53: replies to comments, likes on comments, and editing comments.
-- - Reply to a comment: comments.parent_id points at the comment it answers. Threads are one level
--   deep (like most social apps): replying to a reply joins the same thread, under the top comment.
-- - Like a comment or a reply: comment_likes, with a like_count kept on the comment.
-- - Edit your own comment or reply: only the text changes, and edited_at records when.
-- - Delete: as before (yours, or any on your post, or a club moderator's), and deleting a comment
--   removes its replies too.
-- The person you replied to is notified, as well as the post's author. Additive and safe to re-run.

alter table public.comments add column if not exists parent_id text references public.comments (id) on delete cascade;
alter table public.comments add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists like_count integer not null default 0 check (like_count >= 0);
create index if not exists comments_parent_idx on public.comments (parent_id, created_at) where parent_id is not null;
grant insert (parent_id) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

-- As before (author and names from the database), plus: a reply must be on the same post, and a
-- reply to a reply is filed under the top comment of its thread.
create or replace function public.comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles; parent public.comments;
begin
  if auth.uid() is not null then new.author_id := auth.uid(); new.created_at := now(); end if;
  select * into p from public.profiles where id = new.author_id;
  new.author_first := coalesce(p.first_name, ''); new.author_last := coalesce(p.last_name, '');
  new.like_count := 0;
  new.edited_at := null;
  if new.parent_id is not null then
    select * into parent from public.comments where id = new.parent_id;
    if parent.id is null or parent.post_id <> new.post_id then
      raise exception 'That comment isn''t on this post.' using errcode = 'P0001';
    end if;
    new.parent_id := coalesce(parent.parent_id, parent.id);
  end if;
  return new;
end $$;

-- Editing: only the text, only by its author; the database stamps edited_at. Applies to members
-- (requests running as the authenticated role); the database's own maintenance and tests, running as
-- the owner, can still adjust rows. Security invoker, so current_user is the caller's role.
create or replace function public.comments_before_update() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  new.id := old.id; new.post_id := old.post_id; new.author_id := old.author_id; new.parent_id := old.parent_id;
  new.author_first := old.author_first; new.author_last := old.author_last; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists comments_before_update on public.comments;
create trigger comments_before_update before update on public.comments
  for each row when (pg_trigger_depth() < 1) execute function public.comments_before_update();

drop policy if exists "edit your comments" on public.comments;
create policy "edit your comments" on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- A reply also tells the person you replied to (the post's author already hears about every comment).
create or replace function public.comments_reply_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.posts; to_uid uuid;
begin
  if new.parent_id is null then return null; end if;
  select * into p from public.posts where id = new.post_id;
  select author_id into to_uid from public.comments where id = new.parent_id;
  if to_uid is distinct from p.author_id then
    perform public.notify(to_uid, new.author_id, 'comment', p.id, new.id, p.community_id, new.body);
  end if;
  return null;
end $$;
drop trigger if exists comments_reply_notify on public.comments;
create trigger comments_reply_notify after insert on public.comments
  for each row execute function public.comments_reply_notify();

-- ---------- Likes on comments ----------
create table if not exists public.comment_likes (
  comment_id text not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_id_fk_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from anon, authenticated;
grant select, delete on public.comment_likes to authenticated;
grant insert (comment_id) on public.comment_likes to authenticated;
drop policy if exists "see likes on comments you can see" on public.comment_likes;
create policy "see likes on comments you can see" on public.comment_likes for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
drop policy if exists "like comments you can see" on public.comment_likes;
create policy "like comments you can see" on public.comment_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id));
drop policy if exists "unlike your likes" on public.comment_likes;
create policy "unlike your likes" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

create or replace function public.comment_likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists comment_likes_count on public.comment_likes;
create trigger comment_likes_count after insert or delete on public.comment_likes
  for each row execute function public.comment_likes_count();

revoke execute on function public.comments_before_update(), public.comments_reply_notify(), public.comment_likes_count() from anon, authenticated, public;

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.comment_threads_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.comment_threads_ready() to authenticated;
