-- Step 40: fixes "permission denied for function on_project_team" on every upload (photos, video,
-- club logos), not just project files. project-files.sql (step 38) called on_project_team() inside
-- policies, but verification.sql keeps that function private (it answers for any user and project),
-- and Postgres checks EXECUTE on every function in a policy before evaluating it: so each insert into
-- storage.objects, in any bucket, failed. This adds am_on_project_team(), which only ever answers for
-- the signed-in member, and points the policies at it. Additive and safe to re-run. Run after
-- project-update-files.sql.

create or replace function public.am_on_project_team(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.on_project_team(p_project, auth.uid())
$$;
revoke execute on function public.am_on_project_team(text) from anon, public;
grant execute on function public.am_on_project_team(text) to authenticated;

-- Storage: who may upload into a project's folder.
do $do$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists "project files: the team uploads" on storage.objects';
    execute $p$create policy "project files: the team uploads" on storage.objects for insert to authenticated
      with check (bucket_id = 'project-files'
        and public.am_on_project_team((storage.foldername(name))[1])
        and public.project_file_ext_ok(storage.extension(name)))$p$;
  end if;
end $do$;

-- The files list: the project's team adds files.
drop policy if exists "the team adds" on public.project_files;
create policy "the team adds" on public.project_files for insert to authenticated
  with check (public.am_on_project_team(project_id));

-- Lets the app (and the health check) tell this step has run.
create or replace function public.project_files_access_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.project_files_access_ready() to authenticated;
