-- Tests for supabase/tool-officers.sql: a club's officers, from their AI tools, read Ember's weekly
-- brief and draft an event or an announcement; nothing is published by a tool. Members who aren't
-- officers can't, events need someone who can host them in the app, and verifying isn't reachable.
-- Rolls back.
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

-- Rocketry Club: Ben owns it, Maya is an admin, Josh a member. Make Josh a moderator for one check.
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('b', 64), 'forge_bbbbbb', array['post']) is not null as r1 \gset
reset role; select t.as_('josh'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('1', 64), 'forge_111111', array['post']) is not null as r2 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);

-- ---------- the brief ----------
select t.ok((public.mcp_club_brief(repeat('b', 64), 'rkt'))->>'club' = 'Rocketry Club', 'the owner reads the club''s weekly brief');
select t.ok((select r ? 'posts' and r ? 'upcoming_events' and r->'milestones' ? 'waiting_for_review' and (r->>'can_host_events')::boolean
             from (select public.mcp_club_brief(repeat('b', 64), 'rkt') r) x), '... with the report''s numbers, what waits for review, and whether they can host');
select t.refused($$select public.mcp_club_brief(repeat('1', 64), 'rkt')$$, 'P0001', 'a member who isn''t an officer can''t read it');
update public.community_members set role = 'moderator' where community_id = 'rkt' and uid = :'josh';
select t.ok(not (public.mcp_club_brief(repeat('1', 64), 'rkt')->>'can_host_events')::boolean, 'a moderator reads it, and is told they can''t host events');

-- ---------- announcements ----------
select t.ok((public.mcp_act(repeat('1', 64), 'club_post', '{"club_id":"rkt","body":"Build night moves to Thursday."}', true)->>'drafted')::boolean, 'a moderator drafts an announcement');
select t.ok((select payload->>'club_name' = 'Rocketry Club' from public.tool_drafts where kind = 'club_post' and status = 'waiting'), '... for the card');
select t.refused($$select public.mcp_act(repeat('1', 64), 'club_post', '{"club_id":"rkt","body":"Posted by a bot"}', false)$$, 'P0001', 'a tool never posts it, even with a posting token');
update public.community_members set role = 'member' where community_id = 'rkt' and uid = :'josh';
select t.refused($$select public.mcp_act(repeat('1', 64), 'club_post', '{"club_id":"rkt","body":"hi"}', true)$$, 'P0001', 'a member who isn''t an officer can''t draft one');

-- ---------- events ----------
select t.ok((public.mcp_act(repeat('b', 64), 'event', format('{"club_id":"rkt","title":"Static fire","type":"Workshop","format":"In person","starts_at":"%s"}', (now() + interval '3 days')::text)::jsonb, true)->>'drafted')::boolean,
  'the owner drafts a club event');
select t.ok((select payload->>'title' = 'Static fire' and (payload->>'ends_at')::timestamptz = (payload->>'starts_at')::timestamptz + interval '2 hours' from public.tool_drafts where kind = 'event' and status = 'waiting'),
  '... two hours long when no end is given, as Ember does');
select t.ok(not exists (select 1 from public.events where title = 'Static fire'), '... and nothing is published');
select t.refused(format($$select public.mcp_act(repeat('b', 64), 'event', '{"club_id":"rkt","title":"x","starts_at":"%s"}', false)$$, (now() + interval '3 days')::text), 'P0001', 'a tool never publishes an event');
select t.refused(format($$select public.mcp_act(repeat('1', 64), 'event', '{"club_id":"rkt","title":"x","starts_at":"%s"}', true)$$, (now() + interval '3 days')::text), 'P0001', 'someone who can''t host the club''s events can''t draft one');
select t.refused($$select public.mcp_act(repeat('b', 64), 'event', '{"club_id":"rkt","title":"x","starts_at":"2020-01-01T10:00:00Z"}', true)$$, 'P0001', 'not in the past');
select t.refused($$select public.mcp_act(repeat('b', 64), 'event', '{"club_id":"rkt","title":"x","starts_at":"next tuesday"}', true)$$, 'P0001', 'times must be real times');
select t.refused(format($$select public.mcp_act(repeat('b', 64), 'event', '{"club_id":"rkt","title":"x","type":"Rave","starts_at":"%s"}', true)$$, (now() + interval '3 days')::text), 'P0001', 'only the app''s event types');
select t.refused($$select public.mcp_act(repeat('b', 64), 'review', '{}', true)$$, 'P0001', 'there is no review action: verifying stays in the app');
select t.ok(public.tool_officers_ready(), 'tool_officers_ready()');

select 'tool-officers: all passed' as passed;
rollback;
