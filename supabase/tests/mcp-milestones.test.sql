-- Tests for supabase/mcp-milestones.sql: a tool can log a milestone with evidence and ask its member's
-- club to verify it, only with a token allowed to post, only for their own project and a club they're
-- in. It's pending until an officer decides (the member still can't verify it themselves), the
-- officers are told, and it shows in their review list. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben (owner of Rocketry Club, owner of project p1): a read-only token and a Codex token that may post.
-- Maya (an admin of Rocketry Club): a read-only token, for her review list.
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Cursor', repeat('a', 64), 'forge_aaaaaa') is not null as r1 \gset
select public.create_api_token('Codex', repeat('b', 64), 'forge_bbbbbb', array['read', 'post']) is not null as r2 \gset
reset role; select t.as_('maya'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('c', 64), 'forge_cccccc') is not null as r3 \gset
reset role;
select id as codex_tok from public.api_tokens where token_hash = repeat('b', 64) \gset
delete from public.notifications where kind = 'milestone_request';

-- The server calls as anon, with only the token hash.
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.refused($$select public.mcp_log_milestone(repeat('a', 64), 'p1', 'rkt', 'From a read-only token', '', array['https://github.com/acme/rig/pull/7'])$$, 'P0001', 'a read-only token can''t log a milestone');
select t.refused($$select public.mcp_log_milestone(repeat('b', 64), 'p1', 'rkt', 'No evidence')$$, 'P0001', 'a milestone needs evidence');
select t.refused($$select public.mcp_log_milestone(repeat('b', 64), 'p1', 'rkt', 'Only bad links', '', array['http://insecure.example/x', 'javascript:alert(1)', 'not a link'])$$, 'P0001', 'evidence must be https links');
select t.refused($$select public.mcp_log_milestone(repeat('b', 64), 'p1', 'rkt', '')$$, 'P0001', 'a milestone needs a title');

select (public.mcp_log_milestone(repeat('b', 64), 'p1', 'rkt', 'Gimbal mount holds 1.4 kN', 'Static load test, 3 runs, no yield.',
  array['https://github.com/acme/rig/commit/abc1234', 'https://youtu.be/xyz', 'https://github.com/acme/rig/commit/abc1234', 'http://bad.example'])->>'id') as mid \gset
reset role;
select t.ok((select owner_id = :'ben'::uuid and status = 'pending' and via = 'Codex' and community_id = 'rkt' and project_id = 'p1'
  and evidence = 'https://github.com/acme/rig/commit/abc1234' and jsonb_array_length(evidence_items) = 2 and private from public.milestones where id = :'mid'),
  'it''s Ben''s, pending, via Codex, with 2 distinct https links (first one shown as the evidence), private until verified');
select t.ok((select evidence_items @> '[{"type": "commit", "url": "https://github.com/acme/rig/commit/abc1234"}]' and evidence_items @> '[{"type": "link", "url": "https://youtu.be/xyz"}]' from public.milestones where id = :'mid'),
  'a commit link is recorded as a commit, anything else as a link');
select t.ok(exists (select 1 from public.notifications where user_id = :'maya'::uuid and kind = 'milestone_request'), 'the club''s officers are told');
select t.ok(not exists (select 1 from public.notifications where user_id = :'ben'::uuid and kind = 'milestone_request'), 'the member isn''t asked to review their own');
select t.ok(coalesce(current_setting('request.jwt.claim.sub', true), '') = '', 'the call stops acting as Ben when it''s done');

-- Only Ben's own project, and only a club he's in.
insert into public.projects (id, owner_id, title, summary) values ('joshproj', :'josh', 'Josh''s rig', 'A test rig.');
insert into public.communities (id, name, type, privacy, owner_id, about) values ('notbens', 'Not Ben''s club', 'project', 'public', :'josh', 'x');
insert into public.community_members (community_id, uid, role) values ('notbens', :'josh', 'owner');
set local role anon;
select t.refused($$select public.mcp_log_milestone(repeat('b', 64), 'joshproj', 'rkt', 'On Josh''s project', '', array['https://example.com/proof'])$$, 'P0001', 'a tool can''t log on someone else''s project');
select t.refused($$select public.mcp_log_milestone(repeat('b', 64), 'p1', 'notbens', 'To a club Ben isn''t in', '', array['https://example.com/proof'])$$, 'P0001', 'or ask a club its member isn''t in');

-- Maya's review list has it; Ben's doesn't (you never review your own).
select t.ok((select bool_or(r->>'id' = :'mid' and r->>'via' = 'Codex' and r->>'evidence' = 'https://github.com/acme/rig/commit/abc1234' and (r->>'evidence_count')::int = 2
  and r->>'review_url' = '/c/rkt/manage?tab=verify') from jsonb_array_elements(public.mcp_review_requests(repeat('c', 64))) r), 'it''s in Maya''s review list, with its evidence and where to review it');
select t.ok(not exists (select 1 from jsonb_array_elements(public.mcp_review_requests(repeat('b', 64))) r where r->>'id' = :'mid'), 'it isn''t in Ben''s own review list');

-- A tool never verifies: Ben (the club's owner) still can't verify his own; Maya can.
reset role; select t.as_('ben'); set local role authenticated;
select t.refused(format($$select public.review_milestone(%L, true, 'Looks good')$$, :'mid'), '42501', 'the member can''t verify their own milestone, even as club owner');
reset role; select t.as_('maya'); set local role authenticated;
select public.review_milestone(:'mid', true, 'Watched the load test video.') \g /dev/null
reset role;
select t.ok((select status = 'verified' from public.milestones where id = :'mid'), 'an officer verifies it, as in the app');

-- Nobody can claim a tool logged their milestone.
select t.as_('ben'); set local role authenticated;
select t.refused($$insert into public.milestones (project_id, community_id, title, evidence, via) values ('p1', 'rkt', 'Hand-made', 'https://example.com/x', 'Codex')$$, '42501', 'members can''t set via themselves');

-- Revoked: refused at once.
select public.revoke_api_token(:'codex_tok'::uuid);
reset role; select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.refused($$select public.mcp_log_milestone(repeat('b', 64), 'p1', 'rkt', 'After revoking', '', array['https://example.com/proof'])$$, '42501', 'a revoked token can''t log anything');

reset role;
select t.ok(public.mcp_milestones_ready(), 'the app can tell the step has run');

rollback;
\echo 'mcp-milestones tests: all passed'
