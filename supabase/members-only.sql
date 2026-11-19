-- Members only (Linear FIX-138): member data is readable only by signed-in accounts that have a
-- profile. Run after oauth-signup.sql. Additive; safe to run again.
--
-- A signed-in account can have no profile: a Google, GitHub or LinkedIn newcomer before onboarding's
-- About you step (finish_signup() in oauth-signup.sql), an email sign-up before About you, or anyone
-- who calls Supabase Auth's sign-up API directly. They may be under 18 or not have passed the
-- school-email rule yet. They couldn't write (every member table references profiles), but many read
-- policies say "to authenticated using (true)" or answer for any public club or project, so they
-- could read profiles, posts, clubs, projects and the rest.
--
-- How: one RESTRICTIVE select policy, "members only", on every table members can read. Postgres ANDs
-- restrictive policies with the permissive ones, so each table's existing read rules stay exactly as
-- they are and now also require is_member(). The project-files storage bucket gets the same.
--
-- Unchanged on purpose:
-- - What finishing sign-up needs: finish_signup(), is_school_email(), invite_preview(),
--   request_school(), and the onboarding page's look-up of the caller's own profile (it finds none
--   either way). Those functions run as their owner, so these policies don't touch them.
-- - Everything for signed-out visitors (public_stats(), public_proof(), network_page(),
--   list_networks(), public_club_report(), vouch links, MCP token calls): anon has no table reads,
--   and these policies are for the authenticated role only.
-- - The feature probes in web/src/lib/db-features.ts look only at error codes; an empty result is fine.
-- Security-definer functions that signed-in callers can run were checked one by one (FIX-138): the
-- ones that return rows require a club rank, admin, Pro reviewer or the caller's own records. The
-- yes/no helpers left (can_view, can_read_project, project_role, blocked_between, ...) answer only
-- for ids the caller already has, and someone without a profile can no longer list member ids.

-- True when the signed-in caller has a profile. Security definer so the check can read profiles
-- without going through profiles' own "members only" policy (which calls it). Stable, one indexed
-- look-up; policies call it as (select public.is_member()) so it runs once per query, not per row.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- Every public table the authenticated role can read (FIX-138's inventory). A table added later
-- needs the same policy in its own step; supabase/tests/members-only.test.sql fails until it has one.
do $$
declare t text;
begin
  foreach t in array array[
    'admin_queue', 'api_tokens', 'app_config', 'billing_requests', 'build_events', 'challenge_entries',
    'challenges', 'chat_members', 'chat_message_reactions', 'chat_messages', 'chat_reads', 'chats',
    'club_claims', 'club_handoffs', 'club_integrations', 'club_report_links', 'club_school_links',
    'comment_likes', 'comments', 'communities', 'community_bans', 'community_invites', 'community_members',
    'community_requests', 'connections', 'content_reports', 'conversation_reads', 'conversations',
    'copilot_chats', 'copilot_ratings', 'email_prefs', 'event_rsvps', 'event_saves', 'events', 'feedback',
    'follows', 'github_installations', 'likes', 'member_goals', 'message_blocks', 'message_reactions',
    'message_settings', 'messages', 'milestone_backings', 'milestone_vouches', 'milestones',
    'notifications', 'organization_admins', 'organizations', 'posts', 'pro_reviews', 'profiles',
    'project_details', 'project_files', 'project_members', 'project_repos', 'projects', 'saved',
    'school_requests', 'seen_tours', 'study_leads', 'verification_events'
  ] loop
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I as restrictive for select to authenticated using ((select public.is_member()))', t);
  end loop;
end $$;

-- Project files in Storage (skipped where Storage isn't installed, e.g. the CI database). Other
-- buckets are public (media) and untouched.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists "project files: members only" on storage.objects';
    execute $p$create policy "project files: members only" on storage.objects as restrictive for select to authenticated
      using (bucket_id <> 'project-files' or (select public.is_member()))$p$;
  end if;
end $$;
