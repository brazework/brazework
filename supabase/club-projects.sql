-- Club projects (Linear FIX-264): a project can belong to a club. Run after group-chat-controls.sql.
-- Additive and safe to re-run.
--
-- - projects.community_id: the club a project belongs to (null for a member's own project). Only the
--   club's owner and admins (rank 4+) can start one. The member who starts it is its owner_id, as
--   always; if the club is deleted, the project stays theirs as a personal project.
-- - Every owner and admin of the club runs its club projects: they edit them, make them public or
--   private, delete them and manage the team, the same as the project's owner. Elsewhere they count as
--   the project's 'admin' (project_role), so they can also post updates and add files.
-- - Teammates are added exactly like on a personal project (project_members, step 55): teammates
--   ('member') post updates, add files and log milestones; viewers only see a private one.
-- - Public or private works as for any project: a private club project's card still shows, marked
--   private; everything else is for its team and the club's owners and admins.

alter table public.projects add column if not exists community_id text references public.communities (id) on delete set null;
create index if not exists projects_community_idx on public.projects (community_id, created_at desc) where community_id is not null;
grant insert (community_id) on public.projects to authenticated;

-- Does this member run the club this project belongs to (its owner or an admin)?
create or replace function public.runs_project_club(p_project text, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p join public.community_members m on m.community_id = p.community_id
                 where p.id = p_project and m.uid = p_uid and m.role in ('owner', 'admin'))
$$;
revoke execute on function public.runs_project_club(text, uuid) from anon, public;
grant execute on function public.runs_project_club(text, uuid) to authenticated;

-- May the signed-in member change the project itself (its card, write-up, privacy) or delete it?
create or replace function public.can_edit_project(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p_project and owner_id = auth.uid())
      or public.runs_project_club(p_project, auth.uid())
$$;
revoke execute on function public.can_edit_project(text) from anon, public;
grant execute on function public.can_edit_project(text) to authenticated;

-- Your role on a project (step 55's, plus club projects): the owner; then a project admin; then the
-- club's owners and admins count as admins; then whatever the team gave you.
create or replace function public.project_role(p_project text, p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.projects where id = p_project and owner_id = p_uid) then 'owner'
              when exists (select 1 from public.project_members where project_id = p_project and uid = p_uid and role = 'admin') then 'admin'
              when public.runs_project_club(p_project, p_uid) then 'admin'
              else (select role from public.project_members where project_id = p_project and uid = p_uid) end
$$;

-- Who can see a private project: its owner, the people added to it, and (for a club project) the
-- club's owners and admins. Public ones: everyone, as before.
create or replace function public.can_read_project(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p where p.id = p_project
                 and (not p.private or public.project_role(p.id, auth.uid()) is not null))
$$;

-- Starting one: anyone for themselves; a club project only by the club's owner or admins.
drop policy if exists "add your projects" on public.projects;
create policy "add your projects" on public.projects for insert to authenticated
  with check (owner_id = auth.uid()
    and (community_id is null or exists (select 1 from public.community_members m
         where m.community_id = projects.community_id and m.uid = auth.uid() and m.role in ('owner', 'admin'))));
drop policy if exists "edit your projects" on public.projects;
create policy "edit your projects" on public.projects for update to authenticated
  using (public.can_edit_project(id)) with check (public.can_edit_project(id));
drop policy if exists "delete your projects" on public.projects;
create policy "delete your projects" on public.projects for delete to authenticated
  using (public.can_edit_project(id));

-- The write-up and link: written by whoever may edit the project (was: the owner only).
drop policy if exists "write your details" on public.project_details;
create policy "write your details" on public.project_details for all to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.club_projects_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.club_projects_ready() to authenticated;
