-- Tests for supabase/mcp-writes.sql: a tool can post only with a token allowed to post, only as its
-- member, only to their own projects and clubs they're in, at a tool's pace; the post says which tool
-- made it, and nobody can claim that by hand. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
-- A call that must be refused with this SQL state.
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben makes two tokens: one that can only read (as before), one for Claude Code that can post.
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Cursor', repeat('a', 64), 'forge_aaaaaa') is not null as read_token \gset
select public.create_api_token('Claude Code', repeat('b', 64), 'forge_bbbbbb', array['read', 'post']) is not null as post_token \gset
-- (Members can't read token hashes, by design: these checks look as the database owner.)
reset role;
select t.ok((select scopes = array['read'] from public.api_tokens where token_hash = repeat('a', 64)), 'a token is read-only unless asked');
select t.ok((select scopes = array['read', 'post'] from public.api_tokens where token_hash = repeat('b', 64)), 'a token can be allowed to post');
select id as post_tok from public.api_tokens where token_hash = repeat('b', 64) \gset

-- The MCP server calls as anon, with only the token hash.
reset role; select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.ok((public.mcp_token(repeat('b', 64))->>'tool') = 'Claude Code' and (public.mcp_token(repeat('b', 64))->'scopes') ? 'post', 'the server learns who the token is for and what it may do');
select t.refused($$select public.mcp_post_update(repeat('a', 64), 'From a read-only token')$$, 'P0001', 'a read-only token can''t post');
select t.refused($$select public.mcp_post_update(repeat('c', 64), 'Unknown token')$$, '42501', 'an unknown token can''t post');

select (public.mcp_post_update(repeat('b', 64), 'Shipped the gimbal mount from Claude Code. #rocketry', 'result', 'p1', null, array['Rocketry', 'rocketry', 'bad<tag>'])->>'id') as pid \gset
reset role;
select t.ok((select author_id = :'ben'::uuid and via = 'Claude Code' and kind = 'result' and project_id = 'p1' and like_count = 0 and tags = array['Rocketry'] from public.posts where id = :'pid'),
  'the post is Ben''s, says via Claude Code, keeps its kind and project; tags cleaned');
select t.ok(coalesce(current_setting('request.jwt.claim.sub', true), '') = '', 'the call stops acting as Ben when it''s done');

-- It shows in the feed with which tool made it.
select t.as_('josh'); set local role authenticated;
select t.ok((select c->>'via' = 'Claude Code' from jsonb_array_elements(public.feed_page('latest', 'new', '', '', null, null, null, 30)->'items') c where c->>'id' = :'pid'), 'the feed card says via Claude Code');

-- Nobody can claim a tool made their post.
select t.refused($$insert into public.posts (body, via) values ('I wrote this by hand', 'Claude Code')$$, '42501', 'members can''t set via themselves');
select t.refused($$update public.posts set via = 'Cursor' where author_id = auth.uid()$$, '42501', 'or change it later');

-- Only Ben's own projects, and only clubs he's in.
reset role; select set_config('request.jwt.claim.sub', '', true);
insert into public.projects (id, owner_id, title, summary) values ('joshproj', :'josh', 'Josh''s rig', 'A test rig.');
insert into public.communities (id, name, type, privacy, owner_id, about) values ('notbens', 'Not Ben''s club', 'project', 'public', :'josh', 'x');
insert into public.community_members (community_id, uid, role) values ('notbens', :'josh', 'owner');
set local role anon;
select t.refused($$select public.mcp_post_update(repeat('b', 64), 'On Josh''s project', 'update', 'joshproj')$$, 'P0001', 'a tool can''t post to someone else''s project');
select t.refused($$select public.mcp_post_update(repeat('b', 64), 'Into a club Ben isn''t in', 'update', null, 'notbens')$$, 'P0001', 'or to a club its member isn''t in');
select t.ok((public.mcp_post_update(repeat('b', 64), 'Launch prep update for the club', 'update', null, 'rkt')->>'via') = 'Claude Code', 'but can post to a club its member is in');
select t.refused($$select public.mcp_post_update(repeat('b', 64), '')$$, 'P0001', 'an empty post is refused');
select t.refused($$select public.mcp_post_update(repeat('b', 64), 'x', 'project')$$, 'P0001', 'kind is update, result or question');

-- A tool's pace: 10 posts an hour.
reset role;
update public.posts set created_at = now() - interval '2 hours' where via is not null;  -- start the hour fresh
set local role anon;
do $$ begin for i in 1..10 loop perform public.mcp_post_update(repeat('b', 64), 'Burst ' || i); end loop; end $$;
select t.refused($$select public.mcp_post_update(repeat('b', 64), 'One too many')$$, 'P0001', 'the 11th tool post in an hour is refused');

-- Turning posting off, and revoking, take effect at once. Josh can't touch Ben's tokens.
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(not public.set_api_token_post(:'post_tok'::uuid, false), 'someone else can''t change your token');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok(public.set_api_token_post(:'post_tok'::uuid, false), 'you can turn posting off');
reset role; select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.refused($$select public.mcp_post_update(repeat('b', 64), 'After posting was turned off')$$, 'P0001', 'then the tool can''t post');
reset role; select t.as_('ben'); set local role authenticated;
select public.revoke_api_token(:'post_tok'::uuid);
reset role; select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.ok(public.mcp_token(repeat('b', 64)) is null, 'a revoked token is unknown to the server');

reset role;
select t.ok(public.mcp_writes_ready(), 'the app can tell the step has run');

rollback;
\echo 'mcp-writes tests: all passed'
