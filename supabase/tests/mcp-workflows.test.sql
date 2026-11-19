-- Tests for supabase/mcp-workflows.sql: tokens read, draft or post (read ⊂ draft ⊂ post); a tool can
-- leave drafts that only the member sees and only the member can approve, which then go out under the
-- app's rules; a re-run with the same source_key makes nothing new; log_milestone works without a
-- club (it waits for a signature); my_projects lists what's waiting; a tool asks for a signature only
-- with a token that may post, and through every vouch guard. Runs in one transaction; rolls back.
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

-- ---------- Scopes ----------
-- Ben: an old-style read-only token (a), a new token that drafts (d), one that posts (p), and a
-- GitHub Actions token (g). Josh: a token that drafts (j).
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Cursor', repeat('a', 64), 'forge_aaaaaa') is not null as r1 \gset
select public.create_api_token('Claude Desktop', repeat('d', 64), 'forge_dddddd', array['draft']) is not null as r2 \gset
select public.create_api_token('Claude Code', repeat('e', 64), 'forge_eeeeee', array['post']) is not null as r3 \gset
select public.create_api_token('GitHub Actions (acme/rig)', repeat('f', 64), 'forge_ffffff', array['draft']) is not null as r4 \gset
reset role; select t.as_('josh'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('1', 64), 'forge_111111', array['draft']) is not null as r5 \gset
reset role;
select t.ok((select scopes = '{read}' from public.api_tokens where token_hash = repeat('a', 64)), 'a token made without scopes only reads');
select t.ok((select scopes = '{read,draft}' from public.api_tokens where token_hash = repeat('d', 64)), 'a drafting token reads and drafts');
select t.ok((select scopes = '{read,draft,post}' from public.api_tokens where token_hash = repeat('e', 64)), 'a posting token can also draft');
select t.refused($$update public.api_tokens set scopes = '{read,admin}' where token_hash = repeat('a', 64)$$, '23514', 'there''s no other scope');
select id as gha from public.api_tokens where token_hash = repeat('f', 64) \gset
select id as dtok from public.api_tokens where token_hash = repeat('d', 64) \gset
select t.as_('ben'); set local role authenticated;
select t.ok(not public.set_api_token_post(:'gha'::uuid, true), 'a GitHub Actions token can''t be switched to post');
select t.ok(public.set_api_token_post(:'dtok'::uuid, true), 'another token can');
select t.ok(public.set_api_token_post(:'dtok'::uuid, false), 'and back');
reset role;
select t.ok((select scopes = '{read,draft}' from public.api_tokens where id = :'dtok'), 'turning posting off still leaves drafts');
select t.ok((select scopes = '{read,draft}' from public.api_tokens where id = :'gha'), 'the Actions token still only reads and drafts');
select t.ok(public.api_token_tool('GitHub Actions (acme/rig)') = 'GitHub Actions', 'its drafts say "via GitHub Actions"');

-- ---------- Drafts ----------
select set_config('request.jwt.claim.sub', '', true); set local role anon;
select t.refused($$select public.mcp_draft_post(repeat('a', 64), 'From a read-only token')$$, 'P0001', 'an old read-only token can''t draft');
select t.refused($$select public.mcp_draft_post(repeat('f', 64), 'On Josh''s project', 'update', 'joshproj')$$, 'P0001', 'a draft is checked when it''s made: your own projects only');
select t.refused($$select public.mcp_draft_milestone(repeat('f', 64), 'p1', null, 'No proof')$$, 'P0001', 'a milestone draft needs evidence');
select t.refused($$select public.mcp_post_update(repeat('f', 64), 'Straight out')$$, 'P0001', 'the Actions token can''t post directly');

select (public.mcp_draft_milestone(repeat('f', 64), 'p1', 'rkt', 'Merged: thrust curve logger', 'PR #12, CI green.',
  array['https://github.com/acme/rig/pull/12', 'https://github.com/acme/rig/actions/runs/9'], null, 'GitHub Actions · PR #12 merged', 'github:acme/rig#12')) as d1 \gset
select (:'d1'::jsonb->>'id') as d1id \gset
select t.ok((:'d1'::jsonb->>'status') = 'waiting' and (:'d1'::jsonb->>'duplicate') = 'false' and (:'d1'::jsonb->>'review_url') = '/drafts', 'the Actions token leaves a milestone draft, waiting for Ben');
select t.ok(((public.mcp_draft_milestone(repeat('f', 64), 'p1', 'rkt', 'Merged again', '', array['https://github.com/acme/rig/pull/12'], null, 'rerun', 'github:acme/rig#12'))->>'id') = :'d1id',
  'a re-run with the same source_key gives back the same draft, and makes nothing new');
select (public.mcp_draft_post(repeat('d', 64), 'Bench test: 1.4 kN, no yield. #testing', 'result', 'p1', null, array['Testing', 'testing', 'x<y'], 'Claude Desktop', null)->>'id') as d2id \gset
select (public.mcp_draft_post(repeat('1', 64), 'Josh''s draft')->>'id') as d3id \gset
reset role;
select t.ok((select count(*) = 1 from public.tool_drafts where user_id = :'ben'::uuid and source_key = 'github:acme/rig#12'), 'one draft for that pull request');
select t.ok((select via = 'GitHub Actions' and source = 'GitHub Actions · PR #12 merged' and kind = 'milestone' and payload->>'club_id' = 'rkt' and jsonb_array_length(payload->'evidence') = 2 from public.tool_drafts where id = :'d1id'), 'it records the tool, the source and the evidence');
select t.ok((select payload->'tags' = '["Testing"]'::jsonb from public.tool_drafts where id = :'d2id'), 'tags are cleaned as the app cleans them');
select t.ok(not exists (select 1 from public.posts where body like 'Bench test: 1.4 kN%'), 'nothing is posted while it''s a draft');

-- Only the member sees their drafts.
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 0 from public.tool_drafts), 'Maya sees none of Ben''s drafts');
reset role; select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) = 2 from public.tool_drafts), 'Ben sees his own two, not Josh''s');
select t.refused($$insert into public.tool_drafts (user_id, kind, payload, via) values (auth.uid(), 'post', '{}', 'x')$$, '42501', 'nobody writes drafts directly');
select t.refused(format($$update public.tool_drafts set status = 'posted' where id = %L$$, :'d2id'), '42501', 'or marks one posted by hand');

-- Approving runs as Ben, under the app's rules, and keeps "via".
select t.refused(format($$select public.approve_tool_draft(%L)$$, :'d3id'), '42501', 'Ben can''t approve Josh''s draft');
select (public.approve_tool_draft(:'d2id'::uuid, 'Bench test: the mount held 1.4 kN, no yield. #testing')) as a2 \gset
select t.ok((:'a2'::jsonb->>'status') = 'posted' and (:'a2'::jsonb->>'url') like '/post/%', 'approving a post draft posts it');
select t.refused(format($$select public.approve_tool_draft(%L)$$, :'d2id'), 'P0001', 'a draft goes out once');
select (public.approve_tool_draft(:'d1id'::uuid, null, 'Thrust curve logger merged with CI green')) as a1 \gset
reset role;
select t.ok((select author_id = :'ben'::uuid and via = 'Claude' and kind = 'result' and project_id = 'p1' and body = 'Bench test: the mount held 1.4 kN, no yield. #testing'
  from public.posts where id = (:'a2'::jsonb->>'id')), 'the post is Ben''s, with his edit, via the tool that drafted it');
select t.ok((select owner_id = :'ben'::uuid and status = 'pending' and community_id = 'rkt' and via = 'GitHub Actions' and title = 'Thrust curve logger merged with CI green'
  from public.milestones where id = (:'a1'::jsonb->>'id')), 'the milestone goes to Rocketry Club to verify, edited, via GitHub Actions');
select t.ok(exists (select 1 from public.notifications where user_id = :'maya'::uuid and kind = 'milestone_request'), 'the club''s officers are told, as in the app');
select t.ok((select status = 'posted' and result_id = (:'a1'::jsonb->>'id') and decided_at is not null from public.tool_drafts where id = :'d1id'), 'the draft remembers what it became');
select t.ok(((public.mcp_draft_milestone(repeat('f', 64), 'p1', 'rkt', 'Re-run after posting', '', array['https://github.com/acme/rig/pull/12'], null, '', 'github:acme/rig#12'))->>'duplicate') = 'true', 'a re-run after it was posted still makes nothing new');

-- Dismissing: only your own, only once.
select t.as_('ben'); set local role authenticated;
select t.ok(not public.dismiss_tool_draft(:'d3id'::uuid), 'Ben can''t dismiss Josh''s draft');
reset role; select t.as_('josh'); set local role authenticated;
select t.ok(public.dismiss_tool_draft(:'d3id'::uuid), 'Josh dismisses his own');
select t.ok(not public.dismiss_tool_draft(:'d3id'::uuid), 'only once');
reset role;

-- Limits: 30 waiting at most.
insert into public.tool_drafts (user_id, kind, payload, via) select :'josh'::uuid, 'post', '{"body": "x", "kind": "update"}', 'Claude Code' from generate_series(1, 30);
set local role anon;
select t.refused($$select public.mcp_draft_post(repeat('1', 64), 'One too many')$$, 'P0001', 'at most 30 drafts wait at once');
reset role;

-- ---------- log_milestone without a club: a draft waiting for a signature ----------
set local role anon;
select (public.mcp_log_milestone(repeat('e', 64), 'p1', null, 'Load cell calibrated to ±0.3%', 'Five-point calibration.', array['https://example.com/cal-report'])) as nc \gset
reset role;
select t.ok((:'nc'::jsonb->>'status') = 'draft' and (:'nc'::jsonb->>'next') like '%request_signature%', 'without a club it''s saved and points to request_signature');
select t.ok((select status = 'draft' and community_id is null and via = 'Claude Code' from public.milestones where id = (:'nc'::jsonb->>'id')), 'it waits as a draft, with no club');
select t.ok((select bool_or(m->>'id' = (:'nc'::jsonb->>'id') and m->>'status' = 'draft')
  from jsonb_array_elements(public.mcp_my_projects(repeat('a', 64))) p, jsonb_array_elements(p->'open_milestones') m), 'my_projects lists it under open_milestones, with its id');
select t.ok((select bool_and(m->>'status' in ('draft', 'pending'))
  from jsonb_array_elements(public.mcp_my_projects(repeat('a', 64))) p, jsonb_array_elements(p->'open_milestones') m), 'only milestones still waiting are open');

-- ---------- Signatures ----------
set local role anon;
select t.refused(format($$select public.mcp_request_vouch(repeat('d', 64), %L, 'prof.lee@utexas.edu', 'professor', repeat('9', 64))$$, :'nc'::jsonb->>'id'), 'P0001', 'a token that can''t post can''t ask for a signature');
select t.refused(format($$select public.mcp_request_vouch(repeat('e', 64), %L, 'prof.lee@gmail.com', 'professor', repeat('9', 64))$$, :'nc'::jsonb->>'id'), 'P0001', 'free mail is refused, as in the app');
select t.refused(format($$select public.mcp_request_vouch(repeat('e', 64), %L, 'prof.lee@utexas.edu', 'professor', repeat('9', 64))$$, 'm1'), 'P0001', 'a verified milestone isn''t waiting for proof');
select t.refused(format($$select public.mcp_request_vouch(repeat('1', 64), %L, 'prof.lee@utexas.edu', 'professor', repeat('9', 64))$$, :'nc'::jsonb->>'id'), 'P0001', 'Josh''s token can''t ask about Ben''s milestone (it can''t post, either)');
select (public.mcp_request_vouch(repeat('e', 64), :'nc'::jsonb->>'id', 'Prof.Lee@UTexas.edu', 'professor', repeat('9', 64))) as v \gset
reset role;
select t.ok((:'v'::jsonb->>'member') = 'Ben Cho' and (:'v'::jsonb->>'title') = 'Load cell calibrated to ±0.3%' and (:'v'::jsonb->>'project') = 'Liquid engine test stand', 'it returns what the email needs');
select t.ok((select email = 'prof.lee@utexas.edu' and requested_by = :'ben'::uuid and state = 'asked' from public.milestone_vouches where token_hash = repeat('9', 64)), 'the ask is Ben''s, to the lower-cased address');
select t.ok((select status = 'draft' from public.milestones where id = (:'nc'::jsonb->>'id')) is false, 'asking moves the milestone to pending');
select t.ok(exists (select 1 from public.verification_events where milestone_id = (:'nc'::jsonb->>'id') and action = 'vouch_requested'), 'the ask is in the verification log');
select t.ok(coalesce(current_setting('request.jwt.claim.sub', true), '') = '', 'the call stops acting as Ben when it''s done');

select t.ok(public.mcp_workflows_ready(), 'the app can tell the step has run');

rollback;
\echo 'mcp-workflows tests: all passed'
