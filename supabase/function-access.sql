-- Function access (from Supabase's Security Advisor, 2026-11-18). Run after witness-invites.sql.
-- Additive and safe to run again; changes no data and no rules about who can see what.
--
-- Supabase gives anon a direct EXECUTE grant on every new function in public, on top of PUBLIC.
-- So `revoke execute ... from public` alone (as vouches.sql does for vouch_email_ok) still leaves
-- signed-out visitors able to call the function through /rest/v1/rpc. The advisor counted 24
-- SECURITY DEFINER functions callable signed out. 19 are meant to be (see the list below, also pinned
-- by tests/function-access.test.sql so a new one can't slip in unnoticed). These 5 aren't:
--
--   can_read_message, can_read_chat_message  helpers for message-reaction RLS policies, which are
--                                            all `to authenticated`; signed out they only say false.
--   vouch_email_ok                           internal check inside request_vouch(); vouches.sql
--                                            meant it signed-in only.
--   list_networks                            only the signed-in "start a chapter" page calls it.
--   mcp_user                                 old fallback for /api/mcp from before mcp_token();
--                                            mcp_token() exists, so the route never reaches it.
--
-- They keep working for signed-in members (and the service role), so nothing a member uses changes.
--
-- Stay callable signed out, on purpose:
--   invite_preview, is_school_email, request_school   sign-up and "request my school" (rate limited)
--   vouch_preview, answer_vouch                       vouchers answer by emailed link, without an account
--   public_club_report, public_proof, network_page,   public pages and the health check
--   public_stats
--   mcp_token, mcp_me, mcp_my_clubs, mcp_events,      /api/mcp calls these with the anon key; each one
--   mcp_my_projects, mcp_search, mcp_notifications,   needs the hash of a member's personal token
--   mcp_post_update, mcp_log_milestone,
--   mcp_review_requests
--
-- Every SECURITY DEFINER function in public already has a fixed search_path (hardening.sql), so
-- there's nothing to set here.
--
-- Rollback (if a signed-out page breaks): grant execute on function public.<name>(<args>) to anon;
-- for the one that broke. Or all five:
--   grant execute on function public.can_read_message(text), public.can_read_chat_message(text),
--     public.vouch_email_ok(text), public.list_networks(), public.mcp_user(text) to anon;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('can_read_message', 'can_read_chat_message', 'vouch_email_ok', 'list_networks', 'mcp_user')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Lets the health check (and db-migrate.yml) see this step has run.
create or replace function public.function_access_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.function_access_ready() to authenticated;
