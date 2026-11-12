-- Tests for supabase/who-looked.sql: a verified company looking at your profile notifies you, naming
-- the company and never the person, at most once a week per company; members looking never notify;
-- viewers_for() answers the digest for any member but only with the service key. Runs in one
-- transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false), set_config('t.maya', :'maya', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.refused(call text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when insufficient_privilege then raise notice 'ok: %', what;
end $$;
create function t.seen(who uuid) returns integer language sql as $$
  select count(*)::int from public.notifications where user_id = who and kind = 'company_view' $$;
grant usage on schema t to authenticated, anon, service_role;
grant execute on all functions in schema t to authenticated, anon, service_role;

delete from public.profile_views where profile_id = :'ben';
delete from public.notifications where kind = 'company_view';

-- Cara is an admin of Acme Aerospace, a verified company. She looks at Ben.
select t.as_('cara'); set local role authenticated;
select public.record_profile_view(:'ben');
reset role;
select t.ok(t.seen(:'ben') = 1, 'Ben is told when a verified company looks');
select t.ok((select community_name = 'Acme Aerospace' and actor_id is null and actor_first = '' and actor_last = '' and not read
               from public.notifications where user_id = :'ben' and kind = 'company_view'),
  'it names the company and never the person who looked (no actor)');

-- She looks again the next day: still one this week.
update public.profile_views set day = day - 1, viewed_at = viewed_at - interval '1 day' where profile_id = :'ben';
select t.as_('cara'); set local role authenticated;
select public.record_profile_view(:'ben');
reset role;
select t.ok(t.seen(:'ben') = 1, 'at most once a week per company');

-- A week later she looks again: a new one.
update public.notifications set created_at = now() - interval '8 days' where user_id = :'ben' and kind = 'company_view';
update public.profile_views set day = day - 7, viewed_at = viewed_at - interval '7 days' where profile_id = :'ben';
select t.as_('cara'); set local role authenticated;
select public.record_profile_view(:'ben');
reset role;
select t.ok(t.seen(:'ben') = 2, 'a new week, a new notification');

-- Members looking are only counted, never announced; nor is looking at yourself.
select t.as_('maya'); set local role authenticated;
select public.record_profile_view(:'ben');
reset role; select t.as_('ben'); set local role authenticated;
select public.record_profile_view(:'ben');
reset role;
select t.ok(t.seen(:'ben') = 2, 'a member looking (or you) notifies nobody');
select t.ok(t.seen(:'maya') = 0 and t.seen(:'cara') = 0, 'and the viewers get nothing either');

-- A suspended company isn't named, so it doesn't notify.
update public.organizations set verification_status = 'suspended' where name = 'Acme Aerospace';
update public.notifications set created_at = now() - interval '8 days' where user_id = :'ben' and kind = 'company_view';
select t.as_('cara'); set local role authenticated;
select public.record_profile_view(:'maya');
reset role;
select t.ok(t.seen(:'maya') = 0, 'a suspended company doesn''t notify');
update public.organizations set verification_status = 'verified' where name = 'Acme Aerospace';

-- Ben reads his own notification; nobody else can.
select t.as_('ben'); set local role authenticated;
select t.ok((select count(*) from public.notifications where kind = 'company_view') = 2, 'Ben can read his');
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) from public.notifications where kind = 'company_view' and user_id = current_setting('t.ben')::uuid) = 0, 'Maya can''t read Ben''s');

-- The digest's answer: viewers_for(Ben) with the service key, the same as Ben's own my_viewers().
reset role; set local role service_role;
select t.ok((public.viewers_for(current_setting('t.ben')::uuid, 30)->'companies') = '["Acme Aerospace"]'::jsonb
            and (public.viewers_for(current_setting('t.ben')::uuid, 30)->>'total')::int = 2, 'the digest sees who looked at Ben (it saw nobody before)');
select public.viewers_for(current_setting('t.ben')::uuid, 30)::text as expected \gset
reset role; select t.as_('ben'); set local role authenticated;
select t.ok(public.my_viewers(30) = :'expected'::jsonb, 'my_viewers() is unchanged for a signed-in member');

-- Only the service key may ask about someone else.
select t.refused(format('select public.viewers_for(%L)', :'maya'), 'a member can''t ask who looked at someone else');
reset role; set local role anon;
select t.refused(format('select public.viewers_for(%L)', :'ben'), 'nor can a signed-out visitor');
reset role; select set_config('request.jwt.claim.sub', '', true); set local role authenticated;
select t.ok((public.my_viewers()->>'total')::int = 0, 'my_viewers() with no member answers nothing, not someone''s');

reset role;
select t.ok(public.who_looked_ready(), 'the app can tell the step has run');

rollback;
\echo 'who-looked tests: all passed'
