-- Tests for supabase/tool-clubs-messages.sql: from an AI tool, a member joins a public club or asks
-- to join one that approves members, accepts an invite link, reads their inbox, and drafts a reply
-- that only they can send. Banned members stay out; nobody reads someone else's conversation;
-- a message is never sent by a tool. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

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

-- Tokens: Cara posts (c), Cara drafts (d), Ben posts (b), Josh posts (j).
select t.as_('cara'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('c', 64), 'forge_cccccc', array['post']) is not null as r1 \gset
select public.create_api_token('Claude Desktop', repeat('d', 64), 'forge_dddddd', array['draft']) is not null as r2 \gset
reset role; select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('b', 64), 'forge_bbbbbb', array['post']) is not null as r3 \gset
reset role; select t.as_('josh'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('1', 64), 'forge_111111', array['post']) is not null as r4 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);

-- A club that approves members, owned by Maya, with an invite link; and one Cara is banned from.
insert into public.communities (id, name, type, privacy) values ('sec', 'Secret Society', 'project', 'approval'), ('ban', 'Banned Club', 'project', 'public');
insert into public.community_members (community_id, uid, role) values ('sec', :'maya', 'owner'), ('ban', :'maya', 'owner');
insert into public.community_bans (community_id, uid) values ('ban', :'cara');
insert into public.community_invites (code, community_id, created_by) values ('0123456789abcdef', 'sec', :'maya'), ('fedcba9876543210', 'sec', :'maya');
update public.community_invites set revoked = true where code = 'fedcba9876543210';

-- ---------- join ----------
select t.ok((public.mcp_act(repeat('d', 64), 'join', '{"club_id":"rkt"}', true)->>'drafted')::boolean, 'a drafting token leaves joining Rocketry Club as a card');
select t.ok((select payload->>'club_name' = 'Rocketry Club' and payload->>'privacy' = 'public' from public.tool_drafts where kind = 'join' and status = 'waiting'), '... with the club''s name and that it''s open');
select t.ok(public.mcp_act(repeat('c', 64), 'join', '{"club_id":"rkt"}', false)->>'status' = 'joined', 'a posting token joins a public club at once');
select t.ok(public.my_rank('rkt') is not null and exists (select 1 from public.community_members where community_id = 'rkt' and uid = :'cara' and role = 'member'), '... as a member, nothing more');
select t.refused($$select public.mcp_act(repeat('c', 64), 'join', '{"club_id":"rkt"}', false)$$, 'P0001', 'not twice');
select t.ok(public.mcp_act(repeat('c', 64), 'join', '{"club_id":"sec"}', false)->>'status' = 'requested', 'a club that approves members gets a request, not a member');
select t.ok(not exists (select 1 from public.community_members where community_id = 'sec' and uid = :'cara') and exists (select 1 from public.community_requests where community_id = 'sec' and uid = :'cara'), '... a request');
select t.refused($$select public.mcp_act(repeat('c', 64), 'join', '{"club_id":"sec"}', false)$$, 'P0001', 'not asked twice');
select t.refused($$select public.mcp_act(repeat('c', 64), 'join', '{"club_id":"ban"}', false)$$, 'P0001', 'a banned member can''t join');
select t.refused($$select public.mcp_act(repeat('c', 64), 'join', '{"club_id":"nope"}', false)$$, 'P0001', 'a club that doesn''t exist');

-- ---------- invite ----------
select t.ok(public.mcp_act(repeat('1', 64), 'invite', '{"code":"https://brazework.com/join/0123456789abcdef"}', false)->>'status' = 'joined', 'Josh accepts an invite link (the whole link works) and is in');
select t.ok(exists (select 1 from public.community_members where community_id = 'sec' and uid = :'josh'), '... in the club that approves members, as the invite allows');
select t.ok((select uses = 1 from public.community_invites where code = '0123456789abcdef'), '... and the invite counts the use');
select t.refused($$select public.mcp_act(repeat('1', 64), 'invite', '{"code":"0123456789abcdef"}', false)$$, 'P0001', 'not when already in');
select t.refused($$select public.mcp_act(repeat('b', 64), 'invite', '{"code":"fedcba9876543210"}', false)$$, 'P0001', 'a turned-off invite is refused');
select t.refused($$select public.mcp_act(repeat('b', 64), 'invite', '{"code":"not-a-code"}', true)$$, 'P0001', 'a made-up code is refused, even as a draft');

-- ---------- inbox and replies ----------
-- Josh writes to Ben, as in the app.
select t.as_('josh'); set local role authenticated;
select public.start_conversation(:'ben') as conv \gset
insert into public.messages (conversation_id, body) values (:'conv', 'Can you look at my thrust curve before Friday?');
reset role; select set_config('request.jwt.claim.sub', '', true);
select set_config('t.conv', :'conv', false);

select t.ok((select x->>'kind' = 'request to you' and (x->>'unread')::boolean and x->'with'->>'name' = 'Josh Menzies' and x->>'last' like 'Can you look%'
             from jsonb_array_elements(public.mcp_inbox(repeat('b', 64))) x where x->>'conversation_id' = current_setting('t.conv')),
  'Ben''s inbox shows Josh''s message request, unread, with the last message');
select t.ok((select x->>'kind' = 'waiting for them to accept' from jsonb_array_elements(public.mcp_inbox(repeat('1', 64))) x where x->>'conversation_id' = current_setting('t.conv')),
  '... and Josh''s says he''s waiting');
select t.ok(public.mcp_inbox(repeat('b', 64), current_setting('t.conv'))->'messages'->0->>'from' = 'them', 'Ben reads the conversation');
select t.refused(format($$select public.mcp_inbox(repeat('c', 64), '%s')$$, current_setting('t.conv')), 'P0001', 'Cara can''t read Ben and Josh''s conversation');

select t.ok((public.mcp_act(repeat('b', 64), 'message', format('{"conversation_id":"%s","body":"Sure, send it over."}', current_setting('t.conv'))::jsonb, true)->>'drafted')::boolean,
  'Ben''s assistant drafts a reply in the conversation');
select t.ok((select payload->>'person_id' = current_setting('t.josh') and payload->>'name' = 'Josh Menzies' and (payload->>'accepts_request')::boolean from public.tool_drafts where kind = 'message' and status = 'waiting'),
  '... addressed to Josh, and the card says sending it accepts his request');
select t.refused(format($$select public.mcp_act(repeat('1', 64), 'message', '{"conversation_id":"%s","body":"Did you see it?"}', true)$$, current_setting('t.conv')), 'P0001', 'Josh can''t draft a second message before Ben accepts (the app''s rule)');
select t.ok((select count(*) = 1 from public.messages where conversation_id = current_setting('t.conv')), '... and nothing is sent');
select t.refused(format($$select public.mcp_act(repeat('b', 64), 'message', '{"conversation_id":"%s","body":"Sent by a bot"}', false)$$, current_setting('t.conv')), 'P0001', 'a tool can never send a message, even with a posting token');
select t.refused(format($$select public.mcp_act(repeat('c', 64), 'message', '{"conversation_id":"%s","body":"hi"}', true)$$, current_setting('t.conv')), 'P0001', 'nobody drafts into someone else''s conversation');
select t.refused(format($$select public.mcp_act(repeat('b', 64), 'message', '{"person_id":"%s","body":"hi"}', true)$$, current_setting('t.ben')), 'P0001', 'not to yourself');
select t.refused(format($$select public.mcp_act(repeat('b', 64), 'message', '{"person_id":"%s","body":""}', true)$$, current_setting('t.cara')), 'P0001', 'not an empty message');
select t.ok((public.mcp_act(repeat('b', 64), 'message', format('{"person_id":"%s","body":"Want to join Rocketry?"}', current_setting('t.cara'))::jsonb, true)->>'drafted')::boolean,
  'a first message to someone, by id, is a draft too');
select t.ok(public.tool_clubs_messages_ready(), 'tool_clubs_messages_ready()');

select 'tool-clubs-messages: all passed' as passed;
rollback;
