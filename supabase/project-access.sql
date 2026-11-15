-- Step 55: private projects that really are private, viewers, and project admins.
--
-- - Private until you're ready: while a project is private, its updates (in every feed and on your
--   profile), write-up, link, milestones, files, GitHub activity and team are hidden from everyone
--   but the owner and the people they've added. Its card (title, summary, topics) still shows on
--   your profile, marked private. Make it public and all of it shows at once.
-- - Roles on project_members: 'admin' (manages the team like the owner), 'member' (a teammate who
--   builds: posts updates with files, logs milestones, shows on the team) and 'viewer' (can see a
--   private project, changes nothing).
-- - The owner adds and removes anyone and sets roles; an admin adds and removes teammates and
--   viewers (only the owner makes or removes admins). Anyone can leave.
-- Viewers count as "on the project" for the verification guards (they can't verify or Pro-verify
-- it), but only owners, admins and teammates can upload. Additive and safe to re-run.

alter table public.project_members add column if not exists role text not null default 'member' check (role in ('admin', 'member', 'viewer'));
grant insert (role), update (role) on public.project_members to authenticated;

-- Your role on a project: 'owner', 'admin', 'member', 'viewer', or null.
create or replace function public.project_role(p_project text, p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.projects where id = p_project and owner_id = p_uid) then 'owner'
              else (select role from public.project_members where project_id = p_project and uid = p_uid) end
$$;
revoke execute on function public.project_role(text, uuid) from anon, public;
grant execute on function public.project_role(text, uuid) to authenticated;

-- Uploading and adding files: owners, admins and teammates, not viewers (step 40's helper, narrowed).
create or replace function public.am_on_project_team(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.project_role(p_project, auth.uid()) in ('owner', 'admin', 'member'), false)
$$;

-- Managing the team: the owner, or an admin (who can't touch admins).
create or replace function public.can_manage_project_member(p_project text, p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.project_role(p_project, auth.uid())
           when 'owner' then true
           when 'admin' then coalesce(p_role, 'member') <> 'admin'
           else false end
$$;
revoke execute on function public.can_manage_project_member(text, text) from anon, public;
grant execute on function public.can_manage_project_member(text, text) to authenticated;

drop policy if exists "owners add teammates" on public.project_members;
drop policy if exists "owners and admins add people" on public.project_members;
create policy "owners and admins add people" on public.project_members for insert to authenticated
  with check (public.can_manage_project_member(project_id, role) and uid <> auth.uid());
drop policy if exists "owners and admins set roles" on public.project_members;
create policy "owners and admins set roles" on public.project_members for update to authenticated
  using (public.can_manage_project_member(project_id, role))
  with check (public.can_manage_project_member(project_id, role));
drop policy if exists "owners remove teammates, or leave" on public.project_members;
drop policy if exists "owners and admins remove people, or leave" on public.project_members;
create policy "owners and admins remove people, or leave" on public.project_members for delete to authenticated
  using (uid = auth.uid() or public.can_manage_project_member(project_id, role));
drop policy if exists "see a project's team" on public.project_members;
create policy "see a project's team" on public.project_members for select to authenticated
  using (public.can_read_project(project_id) or uid = auth.uid());

-- The write-up and link: whoever can see the project (was: public, or the owner only).
drop policy if exists "read public details or your own" on public.project_details;
create policy "read public details or your own" on public.project_details for select to authenticated
  using (public.can_read_project(project_id));

-- Updates: a private project's posts are hidden from everyone who can't see the project.
-- Otherwise exactly blocking-content.sql's rule (step 32).
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to authenticated using (
  (status = 'visible' and (community_id is null or public.can_view(community_id)) and not public.blocked_between(auth.uid(), author_id)
    and (project_id is null or public.can_read_project(project_id)))
  or author_id = auth.uid()
  or (community_id is not null and public.my_rank(community_id) >= 3)
);

-- Milestones: verified ones show to everyone only while the project can be seen. The officers asked to
-- verify still see them (they need to). Otherwise exactly the current rule.
drop policy if exists "read milestones" on public.milestones;
create policy "read milestones" on public.milestones for select to authenticated using (
  owner_id = auth.uid()
  or (status = 'verified' and not private and public.can_read_project(project_id))
  or (status <> 'draft' and public.my_rank(community_id) >= 3)
);

-- Everyone building it can post: owners, admins and teammates post updates (and attach files to
-- them, project-update-files.sql) and log milestones on the project. Each person's milestones are
-- their own proof. Viewers can't. Otherwise exactly the current rules.
drop policy if exists "write posts" on public.posts;
create policy "write posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid()
    and (community_id is null or public.my_rank(community_id) > 0)
    and (project_id is null or public.am_on_project_team(project_id)));
drop policy if exists "ask your club to verify" on public.milestones;
create policy "ask your club to verify" on public.milestones for insert to authenticated
  with check (owner_id = auth.uid() and public.am_on_project_team(project_id)
    and (community_id is null or public.my_rank(community_id) > 0));

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.project_access_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.project_access_ready() to authenticated;
