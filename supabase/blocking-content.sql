-- Step 32: blocking hides posts and replies both ways (Linear FIX-50).
-- Before: block_user stopped messages, notifications and follows, but a post shared to a club stayed
-- readable by everyone in that club, including someone the author had blocked. Now, between two
-- people where either blocked the other, neither can read the other's posts or replies. Club
-- moderators still see everything in their club (moderation), and you always see your own.
-- Additive and safe to re-run: one new function, two read policies replaced with stricter ones.

-- Whether either person blocked the other. Security definer: message_blocks only shows you the
-- blocks you made, and this must also know who blocked *you*. Uses the primary key both ways.
create or replace function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.message_blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  )
$$;
revoke execute on function public.blocked_between(uuid, uuid) from anon, public;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;

-- Posts: the same rule as before (visible, and in a club you can see or no club), minus blocked pairs.
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to authenticated using (
  (status = 'visible' and (community_id is null or public.can_view(community_id)) and not public.blocked_between(auth.uid(), author_id))
  or author_id = auth.uid()
  or (community_id is not null and public.my_rank(community_id) >= 3)
);

-- Replies: readable where their post is, minus replies between blocked pairs (your own always show).
drop policy if exists "read comments" on public.comments;
create policy "read comments" on public.comments for select to authenticated using (
  exists (select 1 from public.posts p where p.id = comments.post_id)
  and (author_id = auth.uid() or not public.blocked_between(auth.uid(), author_id))
);
