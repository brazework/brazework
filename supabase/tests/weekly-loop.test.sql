-- Tests for supabase/weekly-loop.sql: my_viewers() names the companies that looked, only counts
-- members, respects the window, and only ever answers for you. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false), set_config('t.maya', :'maya', false), set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- Cara (an admin of Acme Aerospace, a verified company) and Maya (a member) looked at Ben this week;
-- Josh looked three weeks ago.
delete from public.profile_views where profile_id = current_setting('t.ben')::uuid;
insert into public.profile_views (profile_id, viewer, day, viewed_at) values
  (current_setting('t.ben')::uuid, current_setting('t.cara')::uuid, current_date, now() - interval '1 day'),
  (current_setting('t.ben')::uuid, current_setting('t.maya')::uuid, current_date, now() - interval '2 days'),
  (current_setting('t.ben')::uuid, current_setting('t.josh')::uuid, current_date - 21, now() - interval '21 days');

select t.as_('ben'); set local role authenticated;
select t.ok((public.my_viewers(7)->>'total')::int = 2, 'two people looked at Ben this week');
select t.ok(public.my_viewers(7)->'companies' = '["Acme Aerospace"]'::jsonb, 'the company is named; the member who looked is not');
select t.ok((public.my_viewers(30)->>'total')::int = 3, 'a wider window counts the older view too');
select t.ok((public.my_viewers()->>'total')::int = 2, 'the default window is a week');
select t.ok((public.my_viewers(100000)->>'total')::int = 3, 'an oversized window is capped (90 days), not refused');

-- Only ever your own: Maya asking gets Maya's viewers (none), never Ben's.
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((public.my_viewers(30)->>'total')::int = 0 and public.my_viewers(30)->'companies' = '[]'::jsonb, 'Maya sees her own viewers (none), not Ben''s');
do $$ begin perform 1 from public.profile_views limit 1; raise exception 'FAILED: profile views were readable'; exception when insufficient_privilege then raise notice 'ok: views still can''t be read row by row'; end $$;

-- A suspended company isn't named.
reset role;
update public.organizations set verification_status = 'suspended' where name = 'Acme Aerospace';
select t.as_('ben'); set local role authenticated;
select t.ok(public.my_viewers(7)->'companies' = '[]'::jsonb and (public.my_viewers(7)->>'total')::int = 2, 'a suspended company is only counted');

-- Signed-out visitors can't ask at all.
reset role; set local role anon;
do $$ begin perform public.my_viewers(7); raise exception 'FAILED: anon could call my_viewers'; exception when insufficient_privilege then raise notice 'ok: signed-out visitors can''t call it'; end $$;
reset role;
select t.ok(public.weekly_loop_ready(), 'the app can tell the step has run');

rollback;
\echo 'weekly-loop tests: all passed'
