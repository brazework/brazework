-- Tests for supabase/mcp-oauth.sql: a sign-in from an AI assistant becomes a token row of its own,
-- made only as the member (their access token's sub and client_id), starting with read and draft; the
-- same sign-in finds the same row; a revoked sign-in stays revoked; signing in again from the same app
-- closes the old row; nobody can claim someone else's row or make one without a client. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
-- Signed in as a member, through an app (client) or without one (a normal session).
create function t.as_(who text, client text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('t.' || who), 'role', 'authenticated', 'client_id', client)::text, true);
end $$;
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben approves "Claude" on the consent page, then Claude calls for the first time.
select t.as_('ben', 'c1a0de00-0000-4000-8000-000000000001'); set local role authenticated;
select public.remember_oauth_app('c1a0de00-0000-4000-8000-000000000001', 'Claude <script>');
select public.mcp_oauth_link(repeat('a', 64)) as first \gset
select public.mcp_oauth_link(repeat('a', 64)) as again \gset
reset role;
select t.ok(:'first'::jsonb -> 'scopes' = '["read", "draft"]'::jsonb, 'a new sign-in reads and drafts, and can''t post');
select t.ok(:'again'::jsonb = :'first'::jsonb, 'the same sign-in finds the same row');
select t.ok((select count(*) = 1 from public.api_tokens where token_hash = repeat('a', 64) and user_id = :'ben' and oauth_client = 'c1a0de00-0000-4000-8000-000000000001'), 'one row, Ben''s, for that app');
select t.ok((select name = 'Claude script (signed in)' from public.api_tokens where token_hash = repeat('a', 64)), 'it''s named after the app he approved, with no markup');
select t.ok((select public.mcp_token(repeat('a', 64)) ->> 'user_id' = :'ben'), 'every MCP tool now sees Ben through it');

-- Ben turns on posting for it in Settings, like any token; then revokes it.
select id as row_a from public.api_tokens where token_hash = repeat('a', 64) \gset
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_api_token_post(:'row_a', true);
select public.revoke_api_token(:'row_a');
reset role;
select t.as_('ben', 'c1a0de00-0000-4000-8000-000000000001'); set local role authenticated;
select public.mcp_oauth_link(repeat('a', 64)) is null as gone \gset
reset role;
select t.ok(:'gone', 'a revoked sign-in stays revoked: calling again doesn''t bring it back');
select t.ok((select public.mcp_token(repeat('a', 64)) is null), 'and the tools stop at once');

-- Signing in again from the same app makes a new row and closes any open one for that app.
select t.as_('ben', 'c1a0de00-0000-4000-8000-000000000001'); set local role authenticated;
select public.mcp_oauth_link(repeat('b', 64));
select public.mcp_oauth_link(repeat('c', 64));
reset role;
select t.ok((select revoked_at is not null from public.api_tokens where token_hash = repeat('b', 64)), 'a newer sign-in from the same app closes the older one');
select t.ok((select revoked_at is null from public.api_tokens where token_hash = repeat('c', 64)), 'and the newest one works');

-- Josh can't take Ben's row, a normal session (no client) can't make one, and anon can't call it.
select t.as_('josh', 'c1a0de00-0000-4000-8000-000000000001'); set local role authenticated;
select t.refused($$select public.mcp_oauth_link(repeat('c', 64))$$, '42501', 'nobody else can claim a member''s sign-in');
reset role;
select t.as_('ben', null); set local role authenticated;
select t.refused($$select public.mcp_oauth_link(repeat('d', 64))$$, '42501', 'a session that isn''t an app''s sign-in can''t make one');
select t.refused($$select public.mcp_oauth_link('not-a-hash')$$, '42501', 'nor with a bad hash');
reset role;
set local role anon;
select t.refused($$select public.mcp_oauth_link(repeat('e', 64))$$, '42501', 'signed-out callers can''t call it');
reset role;
select t.ok((select count(*) = 0 from public.api_tokens where token_hash in (repeat('d', 64), repeat('e', 64))), 'and none of those made a row');

-- Apps are private to their member.
select t.as_('josh', null); set local role authenticated;
select count(*) as seen from public.mcp_oauth_apps \gset
reset role;
select t.ok(:'seen' = 0, 'Josh can''t see which apps Ben connected');

\echo 'mcp-oauth: all passed'
rollback;
