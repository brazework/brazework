-- Files, 3D models and links on any post (Ian, Nov 22). Run after project-files-view-only.sql. Additive: one new
-- table, a private Storage bucket and its policies, and two functions; nothing the live app uses changes.
--
-- Project updates already carry files (project_files, tied by post_id). Any other post (on the home feed,
-- in a club) can now carry them too, added when it's written or later from Edit, by its author only.
-- They're shown the same way as a project's: a 3D model in the viewer, a PDF in the page's reader,
-- pictures in the pop-up. And the same rule holds (project-files-view-only.sql): someone else's work is
-- for looking at. Storage hands the original of a document or model to its uploader only; everyone who
-- can see the post gets it through the app's viewing route (/api/post-files/<id>), after
-- post_file_access() says they may, and there's no download button.

create table if not exists public.post_files (
  id bigint generated always as identity primary key,
  post_id text not null references public.posts (id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  path text,
  size bigint check (size is null or size between 0 and 52428800),
  url text,
  created_at timestamptz not null default now(),
  constraint post_files_shape check (
    (kind = 'file' and url is null and path is not null
      and path ~ ('^' || post_id || '/[A-Za-z0-9-]{8,64}\.[a-z0-9_]{1,10}$')
      and public.project_file_ext_ok(substring(path from '\.([a-z0-9_]+)$')))
    or (kind = 'link' and path is null and url is not null and char_length(url) <= 500 and url ~* '^https?://[^\s]+$'))
);
create index if not exists post_files_post_idx on public.post_files (post_id, created_at);
create index if not exists post_files_added_by_fk_idx on public.post_files (added_by);
create unique index if not exists post_files_path_key on public.post_files (path) where path is not null;

-- The database sets who added it and when; only the post's author adds, up to 10 per post.
create or replace function public.post_files_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.added_by := auth.uid();
  new.created_at := now();
  new.name := btrim(new.name);
  if not exists (select 1 from public.posts where id = new.post_id and author_id = auth.uid()) then
    raise exception 'Files can only be added to your own posts.' using errcode = '42501';
  end if;
  if (select count(*) from public.post_files where post_id = new.post_id) >= 10 then
    raise exception 'A post can hold up to 10 files and links. Remove some first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists post_files_before_insert on public.post_files;
create trigger post_files_before_insert before insert on public.post_files
  for each row execute function public.post_files_before_insert();
revoke execute on function public.post_files_before_insert() from anon, authenticated, public;

alter table public.post_files enable row level security;
revoke all on public.post_files from anon, authenticated;
grant select, delete on public.post_files to authenticated;
grant insert (post_id, kind, name, path, size, url) on public.post_files to authenticated;

-- Whoever can see the post sees its files (the posts table's own rules decide who sees a post).
drop policy if exists "read with the post" on public.post_files;
create policy "read with the post" on public.post_files for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "members only" on public.post_files;
create policy "members only" on public.post_files as restrictive for select to authenticated using ((select public.is_member()));
drop policy if exists "the author adds" on public.post_files;
create policy "the author adds" on public.post_files for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
drop policy if exists "the author removes" on public.post_files;
create policy "the author removes" on public.post_files for delete to authenticated
  using (added_by = auth.uid());

-- The bucket: private, files under "<post id>/<random>.<ext>". The author uploads and removes; only the
-- uploader reads an original (photos and videos too: here everyone sees them through the app's route).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('post-files', 'post-files', false, 52428800, null)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute 'drop policy if exists "post files: the uploader reads" on storage.objects';
    execute $p$create policy "post files: the uploader reads" on storage.objects for select to authenticated
      using (bucket_id = 'post-files' and owner_id = auth.uid()::text)$p$;
    execute 'drop policy if exists "post files: the author uploads" on storage.objects';
    execute $p$create policy "post files: the author uploads" on storage.objects for insert to authenticated
      with check (bucket_id = 'post-files'
        and exists (select 1 from public.posts p where p.id = (storage.foldername(name))[1] and p.author_id = auth.uid())
        and public.project_file_ext_ok(storage.extension(name)))$p$;
    execute 'drop policy if exists "post files: the uploader deletes" on storage.objects';
    execute $p$create policy "post files: the uploader deletes" on storage.objects for delete to authenticated
      using (bucket_id = 'post-files' and owner_id = auth.uid()::text)$p$;
  end if;
end $$;

-- What the viewing route may do with one: 'none' (no such file, or you can't see its post), 'view'.
create or replace function public.post_file_access(p_id bigint) returns text
language plpgsql stable security invoker set search_path = public as $$
begin
  -- Security invoker: the post_files and posts rules decide, exactly as for the page itself.
  if auth.uid() is null or not exists (select 1 from public.post_files where id = p_id) then return 'none'; end if;
  return 'view';
end $$;
revoke execute on function public.post_file_access(bigint) from public, anon;
grant execute on function public.post_file_access(bigint) to authenticated;

create or replace function public.post_files_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.post_files_ready() to authenticated;
