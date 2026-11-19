-- Tests for supabase/mcp-oauth-post.sql: the consent page's choice decides what a sign-in can do.
-- "When I say yes in chat" gives read + draft + post; "Drafts only" gives read + draft. The choice
-- applies at once to the app's open sign-in, carries over to its next one, and "Can post" in Settings
-- changes the same choice. The old two-argument call still works. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
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

\set claude 'c1a0de00-0000-4000-8000-00000000c1a1'
\set cursor 'c1a0de00-0000-4000-8000-00000000c0c0'

-- Ben connects Claude and keeps the default: things go on his record once he says yes in chat.
select t.as_('ben', :'claude'); set local role authenticated;
select public.remember_oauth_app(:'claude', 'Claude', true);
select public.mcp_oauth_link(repeat('1', 64)) as first \gset
reset role;
select t.ok(:'first'::jsonb -> 'scopes' = '["read", "draft", "post"]'::jsonb, 'approve in chat: the sign-in reads, drafts and adds after the member says yes');
select t.ok((select can_post from public.mcp_oauth_apps where user_id = :'ben' and client_id = :'claude'), 'the choice is kept for the app');

-- He changes his mind on the consent page (a new approval): drafts only, at once, for the open sign-in.
select t.as_('ben', :'claude'); set local role authenticated;
select public.remember_oauth_app(:'claude', 'Claude', false);
reset role;
select t.ok((select scopes = array['read', 'draft'] from public.api_tokens where token_hash = repeat('1', 64)), 'drafts only applies to the open sign-in right away');

-- Settings → Your tools: Can post on. The next sign-in from Claude keeps it.
select id as row1 from public.api_tokens where token_hash = repeat('1', 64) \gset
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_api_token_post(:'row1'::uuid, true) as switched \gset
reset role;
select t.ok(:'switched', 'Can post turns on for a signed-in assistant');
select t.ok((select can_post from public.mcp_oauth_apps where user_id = :'ben' and client_id = :'claude'), 'and becomes the app''s choice');
select t.as_('ben', :'claude'); set local role authenticated;
select public.mcp_oauth_link(repeat('2', 64)) as second \gset
reset role;
select t.ok(:'second'::jsonb -> 'scopes' = '["read", "draft", "post"]'::jsonb, 'signing in again keeps what he chose last');
select t.ok((select revoked_at is not null from public.api_tokens where token_hash = repeat('1', 64)), 'and closes the old sign-in');

-- Turning it off leaves it drafting, never read-only.
select id as row2 from public.api_tokens where token_hash = repeat('2', 64) \gset
select set_config('request.jwt.claim.sub', :'ben', true); set local role authenticated;
select public.set_api_token_post(:'row2'::uuid, false);
reset role;
select t.ok((select scopes = array['read', 'draft'] from public.api_tokens where id = :'row2'), 'Can post off leaves the assistant drafting');
select t.ok((select not can_post from public.mcp_oauth_apps where user_id = :'ben' and client_id = :'claude'), 'and the app''s choice follows');

-- Drafts only from the start, and an app approved with the old call, both start drafting.
select t.as_('ben', :'cursor'); set local role authenticated;
select public.remember_oauth_app(:'cursor', 'Cursor');
select public.mcp_oauth_link(repeat('3', 64)) as old \gset
reset role;
select t.ok(:'old'::jsonb -> 'scopes' = '["read", "draft"]'::jsonb, 'the two-argument call still works and starts with drafts');

-- Nobody else's choice, no bad client ids, nothing signed out.
select t.as_('josh', :'claude'); set local role authenticated;
select public.remember_oauth_app(:'claude', 'Claude', true);
reset role;
select t.ok((select scopes = array['read', 'draft'] from public.api_tokens where id = :'row2'), 'Josh approving the same app changes nothing of Ben''s');
select set_config('request.jwt.claim.sub', :'josh', true); set local role authenticated;
select public.set_api_token_post(:'row2'::uuid, true) as josh_switched \gset
reset role;
select t.ok(not :'josh_switched', 'Josh can''t switch Ben''s sign-in');
select t.as_('ben', :'claude'); set local role authenticated;
select t.refused($$select public.remember_oauth_app('bad client!', 'X', true)$$, 'P0001', 'a bad client id is refused');
reset role;
set local role anon;
select t.refused($$select public.remember_oauth_app('c1a0de00-0000-4000-8000-00000000c1a1', 'X', true)$$, '42501', 'signed-out callers can''t call it');
reset role;

\echo 'mcp-oauth-post: all passed'
rollback;
