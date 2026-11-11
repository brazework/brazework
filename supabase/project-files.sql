-- Step 38: a files folder on every project. Documents, photos, videos, CAD and 3D models, code, and
-- links (GitHub and anything else), added by the owner or a teammate by picking, dropping or pasting.
-- 3D models (STL, OBJ, GLB/glTF, 3MF) open in an interactive viewer on the project page.
-- Additive and safe to re-run.
--
-- Files live in a PRIVATE bucket, "project-files", under "<project id>/<random>.<ext>". Nobody gets a
-- public URL: the app hands out short-lived signed links to people who can read the project. A file
-- is readable exactly when its project is: public projects by any signed-in member, private ones only
-- by the owner and the team. Only file types on the list below can be uploaded (no HTML, SVG or
-- scripts), each up to 50 MB, and a project holds at most 100 items.

-- ---------- Who can do what (security definer: read projects and teams regardless of RLS) ----------
create or replace function public.can_read_project(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p where p.id = p_project
                 and (not p.private or public.on_project_team(p.id, auth.uid())))
$$;
revoke execute on function public.can_read_project(text) from anon, public;
grant execute on function public.can_read_project(text) to authenticated;

-- The file types a project folder accepts, by extension (lower case).
create or replace function public.project_file_ext_ok(p_ext text) returns boolean
language sql immutable as $$
  select lower(coalesce(p_ext, '')) = any (array[
    -- documents
    'pdf','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp','txt','md','csv','json','rtf',
    -- photos and video
    'jpg','jpeg','png','webp','gif','heic','mp4','webm','mov',
    -- 3D models (previewed) and CAD (download)
    'stl','obj','glb','gltf','3mf','step','stp','iges','igs','f3d','sldprt','sldasm','dxf','dwg',
    -- electronics and code
    'kicad_pcb','kicad_sch','brd','sch','gbr','ino','py','ipynb','c','cpp','h','hpp','m','rs','js','ts','java',
    -- archives
    'zip'])
$$;
grant execute on function public.project_file_ext_ok(text) to authenticated;

-- ---------- The bucket (skipped where Storage isn't installed, e.g. the CI database) ----------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('project-files', 'project-files', false, 52428800, null)  -- 50 MB; types are checked by extension
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute 'drop policy if exists "project files: read with the project" on storage.objects';
    execute $p$create policy "project files: read with the project" on storage.objects for select to authenticated
      using (bucket_id = 'project-files' and public.can_read_project((storage.foldername(name))[1]))$p$;
    execute 'drop policy if exists "project files: the team uploads" on storage.objects';
    execute $p$create policy "project files: the team uploads" on storage.objects for insert to authenticated
      with check (bucket_id = 'project-files'
        and public.on_project_team((storage.foldername(name))[1], auth.uid())
        and public.project_file_ext_ok(storage.extension(name)))$p$;
    execute 'drop policy if exists "project files: uploader or owner deletes" on storage.objects';
    execute $p$create policy "project files: uploader or owner deletes" on storage.objects for delete to authenticated
      using (bucket_id = 'project-files' and (owner_id = auth.uid()::text
        or exists (select 1 from public.projects p where p.id = (storage.foldername(name))[1] and p.owner_id = auth.uid())))$p$;
  end if;
end $$;

-- ---------- The folder's items ----------
create table if not exists public.project_files (
  id bigint generated always as identity primary key,
  project_id text not null references public.projects (id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  path text,
  size bigint check (size is null or size between 0 and 52428800),
  url text,
  created_at timestamptz not null default now(),
  constraint project_files_shape check (
    (kind = 'file' and url is null and path is not null
      and path ~ ('^' || project_id || '/[A-Za-z0-9-]{8,64}\.[a-z0-9_]{1,10}$')
      and public.project_file_ext_ok(substring(path from '\.([a-z0-9_]+)$')))
    or (kind = 'link' and path is null and url is not null and char_length(url) <= 500 and url ~* '^https?://[^\s]+$'))
);
create index if not exists project_files_project_idx on public.project_files (project_id, created_at desc);
create index if not exists project_files_added_by_fk_idx on public.project_files (added_by);
create unique index if not exists project_files_path_key on public.project_files (path) where path is not null;

-- The database sets who added it and when, and keeps each project to 100 items.
create or replace function public.project_files_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.added_by := auth.uid();
  new.created_at := now();
  new.name := btrim(new.name);
  if (select count(*) from public.project_files where project_id = new.project_id) >= 100 then
    raise exception 'A project can hold up to 100 files and links. Remove some first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists project_files_before_insert on public.project_files;
create trigger project_files_before_insert before insert on public.project_files
  for each row execute function public.project_files_before_insert();
revoke execute on function public.project_files_before_insert() from anon, authenticated, public;

alter table public.project_files enable row level security;
revoke all on public.project_files from anon, authenticated;
grant select, delete on public.project_files to authenticated;
grant insert (project_id, kind, name, path, size, url) on public.project_files to authenticated;

drop policy if exists "read with the project" on public.project_files;
create policy "read with the project" on public.project_files for select to authenticated
  using (public.can_read_project(project_id));
drop policy if exists "the team adds" on public.project_files;
create policy "the team adds" on public.project_files for insert to authenticated
  with check (public.on_project_team(project_id, auth.uid()));
drop policy if exists "uploader or owner removes" on public.project_files;
create policy "uploader or owner removes" on public.project_files for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.project_files_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.project_files_ready() to authenticated;
