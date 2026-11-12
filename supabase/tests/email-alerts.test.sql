-- Tests for supabase/email-alerts.sql. Runs in one transaction and rolls back. Needs the e2e seed.
\set QUIET on
begin;
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.josh', :'josh', false);
select set_config('t.maya', :'maya', false);
select set_config('t.ben', :'ben', false);
create schema t;
grant usage on schema t to authenticated, service_role;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.must_fail(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then raise exception 'FAILED: expected "%" but got "%" for: %', needle, sqlerrm, q; end if;
    return;
  end;
  raise exception 'FAILED: expected an error ("%") for: %', needle, q;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
-- Josh's alert row for this run (null when he has nothing new).
-- Josh's alert for a run ending now, as JSON (SQL null when he has nothing new); t.has() says whether
-- a part of it is there.
create function t.josh_alert() returns jsonb language sql as $$
  select to_jsonb(r) from public.email_alert_recipients(now()) r where r.user_id = current_setting('t.josh')::uuid $$;
create function t.has(part text) returns boolean language sql as $$
  select coalesce(jsonb_typeof(t.josh_alert() -> part) = 'array', false) $$;
grant execute on all functions in schema t to authenticated, service_role;

-- A clean slate for Josh: nothing unread from before this test (read an hour ago; the test's
-- messages come after that).
update public.notifications set read = true where user_id = :'josh';
insert into public.conversation_reads (conversation_id, user_id, read_at)
  select id, :'josh', now() - interval '1 hour' from public.conversations where :'josh' in (user_a, user_b)
  on conflict (conversation_id, user_id) do update set read_at = excluded.read_at;
select set_config('request.jwt.claim.sub', '', true);

-- Members can't read the address list or move anyone's alerts.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select * from public.email_alert_recipients(now())$$, 'permission denied');
select t.must_fail($$select public.claim_email_alert(auth.uid(), now() - interval '1 hour', now())$$, 'permission denied');
select t.must_fail($$select * from public.alert_sends$$, 'permission denied');
reset role;
set local role service_role;
select t.ok(t.josh_alert() is null, 'nothing new: no alert');
reset role;

-- Maya messages Josh twice, Ben asks to connect, Maya comments on his post: one alert with all three.
-- Inserted directly, with nobody signed in (a signed-in member would become the sender).
select set_config('request.jwt.claim.sub', '', true);
insert into public.conversations (id, user_a, user_b, started_by, status)
  values ('t-conv', least(:'josh'::uuid, :'maya'::uuid), greatest(:'josh'::uuid, :'maya'::uuid), :'maya', 'active')
  on conflict (user_a, user_b) do nothing;
select id as conv from public.conversations where user_a = least(:'josh'::uuid, :'maya'::uuid) and user_b = greatest(:'josh'::uuid, :'maya'::uuid) \gset
insert into public.messages (conversation_id, sender_id, body, created_at) values
  (:'conv', :'maya', 'Are you coming to the build night?', now() - interval '20 minutes'),
  (:'conv', :'maya', 'Bring the motor.', now() - interval '15 minutes');
insert into public.notifications (user_id, actor_id, actor_first, actor_last, kind, created_at) values
  (:'josh', :'ben', 'Ben', 'Ode', 'connect_request', now() - interval '12 minutes'),
  (:'josh', :'maya', 'Maya', 'Lin', 'comment', now() - interval '11 minutes');
set local role service_role;
select t.ok(jsonb_array_length(t.josh_alert() -> 'messages') = 1 and (t.josh_alert() -> 'messages' -> 0 ->> 'n')::int = 2, 'two messages from one person, counted');
select t.ok(t.josh_alert() -> 'requests' ->> 0 = 'Ben Ode', 'the connection request, by name');
select t.ok((t.josh_alert() -> 'comments' -> 0 ->> 'n')::int = 1, 'the comment');
select t.ok(t.josh_alert() ->> 'email' = 'josh@forge.test', 'with his address');
-- Things newer than the run's cut-off wait for the next run.
select t.ok((select count(*) = 0 from public.email_alert_recipients(now() - interval '30 minutes') r where r.user_id = current_setting('t.josh')::uuid), 'nothing before the cut-off');
reset role;

-- Reading them in the app means no email.
update public.notifications set read = true where user_id = :'josh' and kind = 'comment';
set local role service_role;
select t.ok(not t.has('comments') and t.has('messages'), 'a read comment drops out');
reset role;

-- Each kind has its own switch.
select t.as_('josh'); set local role authenticated;
select public.save_email_alerts(false, true, true);
select t.ok((select not alert_messages and alert_requests and alert_comments from public.email_prefs where user_id = auth.uid()), 'Josh turned message emails off');
reset role; set local role service_role;
select t.ok(not t.has('messages') and t.has('requests'), 'so messages drop out, requests stay');
reset role; select t.as_('josh'); set local role authenticated;
select public.save_email_alerts(true, true, true);
reset role;

-- Blocking someone stops their alerts.
insert into public.message_blocks (blocker, blocked) values (:'josh', :'ben');
set local role service_role;
select t.ok(not t.has('requests') and t.has('messages'), 'no alert about someone you blocked');
reset role;
delete from public.message_blocks where blocker = :'josh' and blocked = :'ben';

-- Claiming a send: once per window, even with two runs at once; a failed send hands it back.
set local role service_role;
select t.josh_alert() ->> 'since' as since \gset
select t.ok(public.claim_email_alert(:'josh', :'since', now()), 'the first run claims Josh');
select t.ok(not public.claim_email_alert(:'josh', :'since', now()), 'an overlapping run does not');
select t.ok(t.josh_alert() is null, 'and the next run has nothing new for him');
select public.release_email_alert(:'josh', :'since', now());
select t.ok(t.has('messages'), 'a failed send is retried next run');
reset role;
rollback;
\echo 'email-alerts tests: all passed'
