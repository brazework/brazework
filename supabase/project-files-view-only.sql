-- Documents and 3D models are view-only for people outside the project. Run after owner-club-deletion.sql.
-- Additive: one new restrictive policy on storage and a helper function; nothing else changes.
--
-- Until now anyone who could read a project could also fetch any of its files' originals (a signed link
-- from the private "project-files" bucket), so a visitor could download someone else's CAD, write-up or
-- 3D model. Now only the project's builders (its owner, admins and teammates: am_on_project_team(), not
-- viewers) or the person who uploaded a file can read the original of a document, a model or any other
-- file. Photos and videos are unchanged: they show in posts for everyone who can see the project.
--
-- Everyone else still sees the work: the app streams a document or a model to its viewer (a PDF reader
-- with no download button, the 3D viewer) through its own server route, after checking that they can
-- read the project (can_view_project_file() below), and never hands them a link to the original.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists "project files: originals for the team" on storage.objects';
    execute $p$create policy "project files: originals for the team" on storage.objects as restrictive for select to authenticated
      using (bucket_id <> 'project-files'
        or lower(coalesce(storage.extension(name), '')) = any (array['jpg','jpeg','png','webp','gif','heic','mp4','webm','mov'])
        or owner_id = auth.uid()::text
        or (select public.am_on_project_team((storage.foldername(name))[1])))$p$;
  end if;
end $$;

-- Can the signed-in member see this file at all (it's on a project they can read)? And may they
-- download its original (they're on the team, or they uploaded it)? The server route asks before it
-- streams a file.
create or replace function public.project_file_access(p_id bigint) returns text
language sql stable security definer set search_path = public as $$
  select case
    when f.id is null or not public.can_read_project(f.project_id) then 'none'
    when f.added_by = auth.uid() or public.am_on_project_team(f.project_id) then 'download'
    else 'view'
  end
  from (select 1) one
  left join public.project_files f on f.id = p_id and auth.uid() is not null
$$;
revoke execute on function public.project_file_access(bigint) from public, anon;
grant execute on function public.project_file_access(bigint) to authenticated;

create or replace function public.project_files_view_only_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.project_files_view_only_ready() to authenticated;
