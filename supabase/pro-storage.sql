-- Storage on Supabase Pro (Linear FIX-10): videos up to 250 MB on posts, project updates and project
-- files; everything else stays at 50 MB. Run after media-keys.sql. Additive and safe to re-run.
--
-- A bucket has one size limit for every type, so both buckets go to 250 MB and the smaller limit for
-- photos and other files is kept where it can be told apart:
--   * media: the app shrinks photos before upload (lib/upload.ts) and post_media_ok() only accepts a
--     saved size over 50 MB on a video;
--   * project files: the project_files row is checked here by extension (below).
-- The project-wide "Global file size limit" in the dashboard (Storage > Settings) must be 250 MB too;
-- a bucket can't go above it.

-- ---------- Buckets (skipped where Storage isn't installed, e.g. the CI database) ----------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets set file_size_limit = 262144000,  -- 250 MB
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
    where id = 'media';
    -- Types are checked by extension (project_file_ext_ok), so no type list here.
    update storage.buckets set file_size_limit = 262144000, allowed_mime_types = null where id = 'project-files';
  end if;
end $$;

-- ---------- A project file's size: videos up to 250 MB, everything else up to 50 MB ----------
create or replace function public.project_file_size_ok(p_path text, p_size bigint) returns boolean
language sql immutable as $$
  select p_size is null or (p_size between 0 and 262144000
    and (p_size <= 52428800 or lower(coalesce(substring(p_path from '\.([A-Za-z0-9_]+)$'), '')) in ('mp4', 'webm', 'mov')))
$$;
grant execute on function public.project_file_size_ok(text, bigint) to authenticated;

alter table public.project_files drop constraint if exists project_files_size_check;
alter table public.project_files drop constraint if exists project_files_size_ok;
alter table public.project_files add constraint project_files_size_ok check (public.project_file_size_ok(path, size));

-- ---------- So the app can tell this step has run ----------
create or replace function public.pro_storage_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.pro_storage_ready() to authenticated;
