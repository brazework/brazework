-- Tests for supabase/admin-retention.sql. Runs in one transaction and rolls back. Needs the e2e
-- seed: Maya is a Forge admin, Cara is an admin of Acme Aerospace (a verified company).
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

create schema t;
grant usage on schema t to authenticated;
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
grant execute on all functions in schema t to authenticated;

-- Only Forge admins can read it.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.admin_retention()$$, 'Forge admins only');
reset role;

-- A cohort from three weeks ago: Josh and Ben joined then; Josh comes back the week after.
select set_config('t.cohort', (date_trunc('week', now()) - interval '3 weeks' + interval '1 day')::text, false);
update public.profiles set created_at = current_setting('t.cohort')::timestamptz where id in (current_setting('t.josh')::uuid, current_setting('t.ben')::uuid);
-- The seed's own activity is dated relative to today, so measure the change Josh's return makes.
select t.as_('maya'); set local role authenticated;
select set_config('t.before', public.admin_retention()::text, false);
reset role;
select t.as_('josh');
insert into public.posts (body, kind) values ('retention test: back the next week', 'update');
update public.posts set created_at = current_setting('t.cohort')::timestamptz + interval '7 days' where body = 'retention test: back the next week';

-- A verified company admin (Cara) messages Josh; he replies an hour later. Ben never answers Cara.
-- Written directly with no one signed in (the message trigger replaces the sender with whoever is).
select set_config('request.jwt.claim.sub', '', true);
insert into public.conversations (id, user_a, user_b, started_by, status)
  values ('t-conv-1', least(current_setting('t.cara')::uuid, current_setting('t.josh')::uuid), greatest(current_setting('t.cara')::uuid, current_setting('t.josh')::uuid), current_setting('t.cara')::uuid, 'request'),
         ('t-conv-2', least(current_setting('t.cara')::uuid, current_setting('t.ben')::uuid), greatest(current_setting('t.cara')::uuid, current_setting('t.ben')::uuid), current_setting('t.cara')::uuid, 'request');
insert into public.messages (conversation_id, sender_id, body, created_at) values
  ('t-conv-1', current_setting('t.cara')::uuid, 'Saw your wind tunnel rig. Chat?', now() - interval '2 hours'),
  ('t-conv-2', current_setting('t.cara')::uuid, 'Saw your recovery avionics. Chat?', now() - interval '2 hours');
-- Josh accepts the request (you can't reply to one you haven't accepted), then answers.
update public.conversations set status = 'active' where id = 't-conv-1';
insert into public.messages (conversation_id, sender_id, body, created_at) values
  ('t-conv-1', current_setting('t.josh')::uuid, 'Happy to!', now() - interval '1 hour');

select t.as_('maya'); set local role authenticated;
select set_config('t.r', public.admin_retention()::text, false);
reset role;
select t.ok((select jsonb_array_length(current_setting('t.r')::jsonb -> 'cohorts') = 8), 'eight weekly cohorts, oldest first');
create function t.week1(r text) returns int language sql as $$
  select (c -> 'active' ->> 0)::int from jsonb_array_elements(r::jsonb -> 'cohorts') c
  where c ->> 'week' = to_char(date_trunc('week', current_setting('t.cohort')::timestamptz), 'YYYY-MM-DD') $$;
select t.ok((select (c ->> 'size')::int >= 2 and jsonb_array_length(c -> 'active') = 3
             from jsonb_array_elements(current_setting('t.r')::jsonb -> 'cohorts') c
             where c ->> 'week' = to_char(date_trunc('week', current_setting('t.cohort')::timestamptz), 'YYYY-MM-DD')),
            'the cohort from 3 weeks ago holds everyone who joined then, with 3 later weeks so far');
select t.ok(t.week1(current_setting('t.r')) = t.week1(current_setting('t.before')) + 1, 'Josh coming back the next week counts exactly once');
select t.ok((select jsonb_array_length(c -> 'active') = 0 from jsonb_array_elements(current_setting('t.r')::jsonb -> 'cohorts') c
             where c ->> 'week' = to_char(date_trunc('week', now()), 'YYYY-MM-DD')), 'this week''s cohort has no later weeks yet');
select t.ok((select (current_setting('t.r')::jsonb ->> 'company_conversations_90d')::int >= 2
                and (current_setting('t.r')::jsonb ->> 'company_replied_90d')::int >= 1), 'company conversations and replies are counted');
select t.ok((select (current_setting('t.r')::jsonb ->> 'company_median_hours_to_reply')::numeric between 0.9 and 1.1), 'median time to reply is about an hour');

rollback;
\echo 'admin-retention tests: all passed'
