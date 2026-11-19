-- Tests for supabase/daily-triage.sql: one tap decides a draft from Today. Keep posts it as drafted,
-- or logs a milestone on the project with no club (waiting for a signature); Send to club sends it to
-- a club the member is in, never another; only the member's own waiting drafts, once each, and a
-- refused tap changes nothing. The daily reminder is off until the member turns it on, goes only to
-- the service role, counts only drafts that arrived since the last one, and goes once a day.
-- Runs in one transaction; rolls back.
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
grant usage on schema t to authenticated, anon, service_role;
grant execute on all functions in schema t to authenticated, anon, service_role;

-- Five drafts Ben's tools left: three milestones, two posts.
create function t.ms(club text, ttl text) returns jsonb language sql as $$
  select jsonb_build_object('project_id', 'p1', 'club_id', club, 'title', ttl, 'detail', 'Measured on the stand.',
    'evidence', '[{"type": "link", "url": "https://github.com/acme/rig/pull/40"}]'::jsonb, 'achieved_on', current_date)
$$;
insert into public.tool_drafts (id, user_id, kind, payload, via, source) values
  ('00000000-0000-0000-0000-0000000000a1', :'ben', 'milestone', t.ms('rkt', 'Triage: igniter timing within 5 ms'), 'GitHub Actions', 'PR #40 merged'),
  ('00000000-0000-0000-0000-0000000000a2', :'ben', 'milestone', t.ms('rkt', 'Triage: chamber pressure logged'), 'Claude Code', ''),
  ('00000000-0000-0000-0000-0000000000a3', :'ben', 'milestone', t.ms(null, 'Triage: injector flow test'), 'Claude Code', ''),
  ('00000000-0000-0000-0000-0000000000a4', :'ben', 'post', '{"body": "Triage: static fire #5 is Saturday.", "kind": "update", "project_id": "p1", "club_id": null, "tags": []}', 'Claude Code', ''),
  ('00000000-0000-0000-0000-0000000000a5', :'ben', 'post', '{"body": "Triage: looking for a second pair of hands on the feed system.", "kind": "question", "project_id": null, "club_id": null, "tags": []}', 'Cursor', '');

-- ---------- Who may triage ----------
set local role anon;
select t.refused($$select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a1', 'keep')$$, '42501', 'signed-out visitors can''t triage');
reset role; select t.as_('maya'); set local role authenticated;
select t.refused($$select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a1', 'keep')$$, '42501', 'Maya can''t triage Ben''s draft');
reset role;

-- ---------- Keep ----------
select t.as_('ben'); set local role authenticated;
select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a1', 'keep') as k1 \gset
select t.ok((:'k1'::jsonb->>'status') = 'draft' and (:'k1'::jsonb->>'url') = '/projects/p1', 'Keep logs a milestone on the project, waiting for a signature');
select t.refused($$select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a1', 'keep')$$, 'P0001', 'a draft is decided once');
select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a4', 'keep') as k4 \gset
select t.ok((:'k4'::jsonb->>'status') = 'posted', 'Keep posts a post as drafted');
reset role;
select t.ok((select status = 'draft' and community_id is null and owner_id = :'ben'::uuid and via = 'GitHub Actions'
  from public.milestones where id = (:'k1'::jsonb->>'id')), 'the kept milestone is Ben''s, with no club, via the tool that drafted it');
select t.ok((select author_id = :'ben'::uuid and community_id is null and project_id = 'p1' from public.posts where id = (:'k4'::jsonb->>'id')), 'the kept post is Ben''s, on his project');
select t.ok((select status = 'posted' and result_id = (:'k1'::jsonb->>'id') from public.tool_drafts where id = '00000000-0000-0000-0000-0000000000a1'), 'the draft remembers what it became');

-- ---------- Send to club ----------
select t.as_('ben'); set local role authenticated;
select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a2', 'club') as c2 \gset
select t.ok((:'c2'::jsonb->>'status') = 'pending', 'Send to club with no pick uses the club it was drafted for');
select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a3', 'club', 'rob') as c3 \gset
select t.ok((:'c3'::jsonb->>'status') = 'pending', 'a milestone drafted with no club can go to a club Ben is in');
select t.refused($$select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a5', 'club')$$, 'P0001', 'Send to club needs a club');
select t.refused($$select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a5', 'club', 'nope')$$, 'P0001', 'only a club Ben is in');
select t.refused($$select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a5', 'publish')$$, 'P0001', 'there are only two ways to keep a draft');
reset role;
select t.ok((select status = 'waiting' and payload->'club_id' = 'null'::jsonb from public.tool_drafts where id = '00000000-0000-0000-0000-0000000000a5'),
  'a refused tap leaves the draft as it was');
select t.ok((select community_id = 'rkt' and status = 'pending' from public.milestones where id = (:'c2'::jsonb->>'id')), 'it went to Rocketry Club to verify');
select t.ok((select community_id = 'rob' and status = 'pending' from public.milestones where id = (:'c3'::jsonb->>'id')), 'and that one to Robotics Society');
select t.ok(exists (select 1 from public.notifications where user_id = :'maya'::uuid and kind = 'milestone_request'), 'the club''s officers are told, as in the app');
select t.as_('ben'); set local role authenticated;
select public.triage_tool_draft('00000000-0000-0000-0000-0000000000a5', 'club', 'rkt') as c5 \gset
reset role;
select t.ok((select community_id = 'rkt' and kind = 'question' from public.posts where id = (:'c5'::jsonb->>'id')), 'a post sent to a club is posted in that club');

-- ---------- The daily reminder ----------
insert into public.tool_drafts (user_id, kind, payload, via) values
  (:'ben', 'post', '{"body": "r1", "kind": "update"}', 'GitHub Actions'),
  (:'ben', 'post', '{"body": "r2", "kind": "update"}', 'GitHub Actions'),
  (:'ben', 'post', '{"body": "r3", "kind": "update"}', 'Claude Code'),
  (:'maya', 'post', '{"body": "m1", "kind": "update"}', 'Cursor');
insert into public.tool_drafts (user_id, kind, payload, via, created_at) values (:'ben', 'post', '{"body": "old", "kind": "update"}', 'Zed', now() - interval '3 days');

set local role service_role;
select t.ok(not exists (select 1 from public.draft_reminder_recipients()), 'off until the member turns it on');
reset role;
select t.as_('ben'); set local role authenticated;
select public.save_draft_reminder(true);
select t.refused($$select * from public.draft_reminder_recipients()$$, '42501', 'members can''t read who gets reminders');
select t.refused($$select public.claim_draft_reminder(auth.uid())$$, '42501', 'or claim one');
select t.ok((select daily_drafts from public.email_prefs where user_id = auth.uid()), 'Ben turns it on');
reset role;

set local role service_role;
select t.ok((select count(*) = 1 from public.draft_reminder_recipients()), 'only members who turned it on (Maya didn''t)');
select t.ok((select waiting = 4 and fresh = 3 and tools = '[{"n": 2, "via": "GitHub Actions"}, {"n": 1, "via": "Claude Code"}]'::jsonb and email = 'ben@forge.test'
  from public.draft_reminder_recipients() where user_id = :'ben'::uuid), 'it counts what arrived in the last day, by tool (the 3-day-old one is waiting but not new)');
select t.ok(public.claim_draft_reminder(:'ben'), 'a run claims Ben''s reminder');
select t.ok(not public.claim_draft_reminder(:'ben'), 'a second run the same day can''t');
select t.ok(not exists (select 1 from public.draft_reminder_recipients() where user_id = :'ben'::uuid), 'and he isn''t listed again today');
select public.release_draft_reminder(:'ben');
select t.ok(exists (select 1 from public.draft_reminder_recipients() where user_id = :'ben'::uuid), 'a failed send hands it back');
-- Tomorrow: only drafts that arrived after today's reminder count.
-- (now() stands still in a transaction, so "yesterday" is set by hand.)
select public.claim_draft_reminder(:'ben');
reset role;
update public.draft_reminder_sends set day = day - 1, sent_at = now() - interval '1 day';
update public.tool_drafts set created_at = now() - interval '25 hours' where user_id = :'ben'::uuid and payload->>'body' in ('r1', 'r2', 'r3');
set local role service_role;
select t.ok(not exists (select 1 from public.draft_reminder_recipients() where user_id = :'ben'::uuid), 'nothing new since the last reminder, no email');
reset role;
insert into public.tool_drafts (user_id, kind, payload, via) values (:'ben', 'post', '{"body": "r4", "kind": "update"}', 'Claude Code');
set local role service_role;
select t.ok((select fresh = 1 and waiting = 5 from public.draft_reminder_recipients() where user_id = :'ben'::uuid), 'a new draft the next day brings one');
reset role;
select t.as_('ben'); set local role authenticated;
select public.save_draft_reminder(false);
reset role; set local role service_role;
select t.ok(not exists (select 1 from public.draft_reminder_recipients()), 'turning it off stops it');
reset role;

select 'daily-triage: all passed' as passed;
rollback;
