-- Tests for supabase/tool-rsvp.sql: RSVP from AI tools, under the app's rules. A drafting token
-- leaves an RSVP card; a posting token saves a spot (and takes it back) at once; nobody RSVPs to an
-- event they can't see, one that's over, or twice, or cancels a spot they don't have. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

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

select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Desktop', repeat('d', 64), 'forge_dddddd', array['draft']) is not null as r1 \gset
select public.create_api_token('Claude Code', repeat('e', 64), 'forge_eeeeee', array['post']) is not null as r2 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);

-- A build night in Rocketry Club (public), one that's over, and one in a private club Ben isn't in.
insert into public.communities (id, name, type, privacy) values ('sec', 'Secret Society', 'project', 'approval');
insert into public.community_members (community_id, uid, role) values ('sec', :'maya', 'owner');
insert into public.events (id, community_id, title, type, format, topic, starts_at, ends_at) values
  ('ev1', 'rkt', 'Build night', 'Workshop', 'In person', 'Aerospace', now() + interval '1 day', now() + interval '1 day 2 hours'),
  ('ev2', 'rkt', 'Last week''s launch', 'Workshop', 'In person', 'Aerospace', now() - interval '3 days', now() - interval '3 days' + interval '2 hours'),
  ('ev3', 'sec', 'Members only', 'Workshop', 'Online', 'Aerospace', now() + interval '1 day', now() + interval '1 day 1 hour');

select t.ok((public.mcp_act(repeat('d', 64), 'rsvp', '{"event_id":"ev1"}', true)->>'drafted')::boolean, 'a drafting token leaves an RSVP for Ben to confirm');
select t.ok(not exists (select 1 from public.event_rsvps where event_id = 'ev1'), '... and Ben isn''t going yet');
select t.ok((select payload->>'title' = 'Build night' and payload->>'cancel' = 'false' and payload->>'host' = 'Rocketry Club' from public.tool_drafts where kind = 'rsvp' and status = 'waiting'),
  '... with the event''s name, host and time for the card');
select t.ok(public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"ev1","going":true}', false)->>'status' = 'going', 'a posting token saves Ben a spot');
select t.ok((select rsvp_count = 1 from public.events where id = 'ev1') and exists (select 1 from public.event_rsvps where event_id = 'ev1' and user_id = :'ben'), '... counted, as from the app');
select t.refused($$select public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"ev1"}', false)$$, 'P0001', 'not twice');
select t.refused($$select public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"ev2"}', false)$$, 'P0001', 'not to an event that''s over');
select t.refused($$select public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"ev3"}', false)$$, 'P0001', 'not to an event in a club Ben can''t see');
select t.refused($$select public.mcp_act(repeat('d', 64), 'rsvp', '{"event_id":"ev3"}', true)$$, 'P0001', '... not even as a draft');
select t.refused($$select public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"nope"}', false)$$, 'P0001', 'not to an event that doesn''t exist');
select t.ok(public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"ev1","going":false}', false)->>'status' = 'not going', 'a posting token takes Ben''s spot back');
select t.ok((select rsvp_count = 0 from public.events where id = 'ev1') and not exists (select 1 from public.event_rsvps where event_id = 'ev1'), '... uncounted');
select t.refused($$select public.mcp_act(repeat('e', 64), 'rsvp', '{"event_id":"ev1","going":false}', false)$$, 'P0001', 'nothing to cancel twice');
select t.ok(public.tool_rsvp_ready(), 'tool_rsvp_ready()');

select 'tool-rsvp: all passed' as passed;
rollback;
