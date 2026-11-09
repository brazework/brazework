-- Editing posts: the author can change a post's text and topics at any time, and the post shows
-- "Edited". Run after invites.sql. Additive: existing posts keep edited_at empty.
--
-- edited_at is set only by the database, only when the text, type or topics actually change,
-- so nobody can fake or hide an edit. Who may edit is unchanged (schema.sql: only the author
-- changes the text; moderators can only publish held posts).

alter table public.posts add column edited_at timestamptz;

create or replace function public.posts_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.body, new.kind, new.tags) is distinct from (old.body, old.kind, old.tags) then
    if old.author_id <> auth.uid() then
      raise exception 'Only the author can edit a post.' using errcode = '42501';
    end if;
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  if new.status is distinct from old.status
     and not (old.community_id is not null and new.status = 'visible' and public.my_rank(old.community_id) >= 3) then
    raise exception 'Only moderators can review posts.' using errcode = '42501';
  end if;
  return new;
end $$;
