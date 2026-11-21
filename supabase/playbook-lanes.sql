-- Step 88: playbook lanes (Linear FIX-209). Run after account-type.sql. Additive and safe to re-run.
--
-- Every field's playbook has a part for studying and a part for working (web/src/lib/mcp-playbooks.ts,
-- docs/superpowers/specs/2026-11-20-playbook-lanes-design.md). A member's assistant picks the part from
-- what me says about them, so me now also returns account_type ('student' or 'professional') beside the
-- clubs count it already had: a student is Studying, a professional in no club is Working, and a
-- professional in a club is asked which it was. Nothing else about me changes.

create or replace function public.mcp_me(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash); r jsonb;
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  select jsonb_build_object(
    'id', p.id, 'name', btrim(p.first_name || ' ' || p.last_name), 'headline', p.headline, 'field', p.field,
    'account_type', p.account_type,
    'interests', p.interests, 'profile_url', '/u/' || p.id,
    'projects', (select count(*) from public.projects where owner_id = me),
    'verified_milestones', (select count(*) from public.milestones where owner_id = me and status = 'verified'),
    'clubs', (select count(*) from public.community_members where uid = me),
    'unread_notifications', (select count(*) from public.notifications where user_id = me and not read))
  into r from public.profiles p where p.id = me;
  return r;
end $$;

-- Lets the health check tell this step has run (supabase/maintenance/health-check.sql).
create or replace function public.playbook_lanes_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.playbook_lanes_ready() to authenticated;
