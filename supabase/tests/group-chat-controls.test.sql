\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset

create schema group_chat_test;
grant usage on schema group_chat_test to authenticated;

create function group_chat_test.ok(condition boolean, description text) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAILED: %', description; end if;
end $$;
create function group_chat_test.cannot_delete(chat_id text) returns void language plpgsql as $$
begin
  perform public.delete_owned_team_chat(chat_id);
  raise exception 'FAILED: unauthorized chat deletion';
exception when insufficient_privilege then null;
end $$;

grant execute on all functions in schema group_chat_test to authenticated;

insert into public.events (id, community_id, title, type, format, topic, starts_at, ends_at)
values ('gc-event', 'rkt', 'Group chat event', 'Workshop', 'Online', 'Aerospace', now() + interval '1 day', now() + interval '1 day 1 hour');
insert into public.event_rsvps (event_id, user_id) values ('gc-event', :'josh');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'josh', true);
select public.open_club_chat('rkt') as club \gset
select public.open_event_chat('gc-event') as event \gset
select public.create_team_chat('rkt', 'Group controls', array[:'ben', :'maya']::uuid[]) as team \gset
insert into public.chat_messages (chat_id, body) values (:'team', 'Test group chat') returning id as message \gset
insert into public.chat_message_reactions (message_id, emoji) values (:'message', '👍');

select group_chat_test.cannot_delete(:'club');
select group_chat_test.cannot_delete(:'event');
select public.leave_chat(:'club');
select public.leave_chat(:'club');
select public.leave_chat(:'event');
select group_chat_test.ok(not public.can_read_chat(:'club') and not public.can_read_chat(:'event'), 'club and event opt-outs remove access');
select group_chat_test.ok(not (public.my_chats() @> jsonb_build_array(jsonb_build_object('id', :'club')))
              and not (public.my_chats() @> jsonb_build_array(jsonb_build_object('id', :'event'))), 'left chats disappear from the list');
select group_chat_test.ok(public.my_rank('rkt') >= 1, 'leaving a club chat preserves membership');
select group_chat_test.ok(exists(select 1 from public.event_rsvps where event_id = 'gc-event' and user_id = :'josh'), 'leaving an event chat preserves the RSVP');
select group_chat_test.ok(public.open_club_chat('rkt') = :'club' and public.open_event_chat('gc-event') = :'event', 'explicit rejoin uses the original chats');
select group_chat_test.ok(public.can_read_chat(:'club') and public.can_read_chat(:'event'), 'explicit rejoin restores access');

select set_config('request.jwt.claim.sub', :'maya', true);
select group_chat_test.cannot_delete(:'team');
select public.leave_chat(:'team');
select group_chat_test.ok(not public.can_read_chat(:'team'), 'regular member can leave without deleting the team chat');
select group_chat_test.ok(not exists(select 1 from public.chat_message_reactions where message_id = :'message'), 'departed member cannot read reactions');

select set_config('request.jwt.claim.sub', :'josh', true);
select public.leave_chat(:'team');
select group_chat_test.ok(not public.can_read_chat(:'team'), 'owner can leave');
select group_chat_test.cannot_delete(:'team');

select set_config('request.jwt.claim.sub', :'ben', true);
select group_chat_test.ok((select created_by = :'ben' from public.chats where id = :'team'), 'remaining member takes ownership');
select public.delete_owned_team_chat(:'team');
reset role;
select group_chat_test.ok(not exists(select 1 from public.chats where id = :'team'), 'owner deletion removes chat');
select group_chat_test.ok(not exists(select 1 from public.chat_messages where chat_id = :'team'), 'owner deletion removes messages');
select group_chat_test.ok(not exists(select 1 from public.chat_message_reactions where message_id = :'message'), 'owner deletion removes reactions');
select group_chat_test.ok(not has_function_privilege('anon', 'public.delete_owned_team_chat(text)', 'EXECUTE'), 'anonymous users cannot call delete');

rollback;
\echo 'group-chat-controls tests: all passed'
