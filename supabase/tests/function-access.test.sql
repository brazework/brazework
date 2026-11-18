-- Tests for supabase/function-access.sql: the five functions that only make sense signed in refuse
-- signed-out callers but still work signed in, and the SECURITY DEFINER functions a signed-out
-- visitor can call are exactly the ones meant to be, so a new one fails here instead of shipping.
-- Runs in one transaction; rolls back.
\set QUIET on
begin;

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('can_read_message', 'can_read_chat_message', 'vouch_email_ok', 'list_networks', 'mcp_user')
    and has_function_privilege('anon', p.oid, 'execute')
), 'signed-out visitors can''t call the five signed-in-only functions');

select t.ok((
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('can_read_message', 'can_read_chat_message', 'vouch_email_ok', 'list_networks', 'mcp_user')
    and has_function_privilege('authenticated', p.oid, 'execute')
) >= 5, 'signed-in members still can');

-- Every SECURITY DEFINER function a signed-out visitor can call is on this list. Adding one on purpose?
-- Grant it to anon in its own step and add it here, with a word in function-access.sql on why.
create temp table allowed(name text) on commit drop;
insert into allowed values
  ('invite_preview'), ('is_school_email'), ('request_school'),
  ('vouch_preview'), ('answer_vouch'),
  ('public_club_report'), ('public_proof'), ('network_page'), ('public_stats'),
  ('mcp_token'), ('mcp_me'), ('mcp_my_clubs'), ('mcp_events'), ('mcp_my_projects'), ('mcp_search'),
  ('mcp_notifications'), ('mcp_post_update'), ('mcp_log_milestone'), ('mcp_review_requests');

select coalesce(string_agg(p.oid::regprocedure::text, ', '), '') as extra from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in (select name from allowed) \gset
select t.ok(:'extra' = '', 'no unexpected SECURITY DEFINER function is open signed out: ' || :'extra');

select t.ok(has_function_privilege('anon', 'public.public_club_report(text)', 'execute'), 'public club report links still open signed out');
select t.ok(has_function_privilege('anon', 'public.mcp_token(text)', 'execute'), 'the MCP server can still check a token');

-- Still works signed in: the "start a chapter" page lists networks.
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('request.jwt.claim.sub', :'josh', true);
set local role authenticated;
select jsonb_typeof(public.list_networks()) as kind \gset
reset role;
select t.ok(:'kind' = 'array', 'list_networks still runs signed in');

rollback;
\echo 'function-access tests: all passed'
