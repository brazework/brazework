-- A post can be just its files (Linear FIX-247). Run after student-plus-email.sql. Changes one check on
-- posts; nothing else.
--
-- Attaching a file to a project update used to write "Added photo.jpg, cube.stl…" as the post's text
-- when the box was left empty, because a post had to have at least one character. Now a project update
-- (its files and links are saved alongside it) or a post with photos or a video may have no text. Every
-- other post still needs some, and none can be longer than 3,000 characters.
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (char_length(body) <= 3000 and (char_length(btrim(body)) >= 1 or kind = 'project' or jsonb_array_length(media) > 0));

create or replace function public.post_files_only_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.post_files_only_ready() to authenticated;
