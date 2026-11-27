-- Tests for supabase/chat-delete.sql: deleting a chat clears it for you only. Runs in one transaction and
-- rolls back. Needs the e2e seed (Josh, Maya and Cara).
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

create schema t;
grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.must_fail(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then raise exception 'FAILED: expected "%" but got "%"', needle, sqlerrm; end if;
    return;
  end;
  raise exception 'FAILED: expected an error ("%") for: %', needle, q;
end $$;
grant execute on all functions in schema t to authenticated;

select set_config('request.jwt.claim.sub', '', true);
insert into public.conversations (id, user_a, user_b, started_by, status)
  values ('t-del', least(:'josh'::uuid, :'maya'::uuid), greatest(:'josh'::uuid, :'maya'::uuid), :'maya', 'active')
  on conflict (user_a, user_b) do nothing;
select id as conv from public.conversations where user_a = least(:'josh'::uuid, :'maya'::uuid) and user_b = greatest(:'josh'::uuid, :'maya'::uuid) \gset
select set_config('t.conv', :'conv', false);
insert into public.messages (conversation_id, sender_id, body, created_at) values (:'conv', :'maya', 'See you at the build night', now() - interval '5 minutes');

set local role authenticated;
select t.as_('josh');
select public.clear_conversation(current_setting('t.conv'));
select t.ok((select cleared_at is not null and read_at >= cleared_at from public.conversation_reads where conversation_id = current_setting('t.conv') and user_id = auth.uid()), 'deleting clears it for me and marks it read');
select t.as_('maya');
select t.ok((select count(*) from public.messages where conversation_id = current_setting('t.conv') and body = 'See you at the build night') = 1, 'the other person keeps their copy');
select t.as_('cara');
select t.must_fail(format('select public.clear_conversation(%L)', current_setting('t.conv')), 'isn''t available');
reset role;

\echo 'chat-delete: all passed'
rollback;
