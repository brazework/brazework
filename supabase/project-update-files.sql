-- Step 39: files ride along with project updates. One place to post: the "Post an update" box takes
-- text plus files, 3D models and links, and they go up together as one update. Each file remembers
-- the update it came with (post_id), so it shows under that update and in the project's Files.
-- If the update is deleted, its files stay in the project's Files (post_id is cleared).
-- Additive and safe to re-run. Run after project-files.sql.

alter table public.project_files add column if not exists post_id text references public.posts (id) on delete set null;
create index if not exists project_files_post_id_fk_idx on public.project_files (post_id) where post_id is not null;
grant insert (post_id) on public.project_files to authenticated;

-- As before (who added it, when, at most 100 per project), plus: an attachment must belong to an
-- update you wrote on this same project.
create or replace function public.project_files_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.added_by := auth.uid();
  new.created_at := now();
  new.name := btrim(new.name);
  if new.post_id is not null and not exists (
    select 1 from public.posts where id = new.post_id and project_id = new.project_id and author_id = auth.uid()
  ) then
    raise exception 'Files can only be attached to your own update on this project.' using errcode = '42501';
  end if;
  if (select count(*) from public.project_files where project_id = new.project_id) >= 100 then
    raise exception 'A project can hold up to 100 files and links. Remove some first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.project_files_before_insert() from anon, authenticated, public;

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.project_update_files_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.project_update_files_ready() to authenticated;
