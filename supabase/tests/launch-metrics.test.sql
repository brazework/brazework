-- Tests for supabase/launch-metrics.sql (step 92): the launch numbers on the admin page. Runs in one
-- transaction and rolls back. Needs the e2e seed (Maya is a Brazework admin; Ben owns project p1 in
-- Rocketry Club; Josh is a member). Each number is checked by what adding rows does to it.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false);

create schema t;
grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create table t.snap (k text primary key, v jsonb);
grant all on t.snap to authenticated;
grant execute on all functions in schema t to authenticated;

-- ---------- Only Brazework admins ----------
select t.as_('ben'); set local role authenticated;
do $$ begin
  perform public.admin_launch_metrics();
  raise exception 'FAILED: a member read the launch numbers';
exception when insufficient_privilege then raise notice 'ok: a member can''t read the launch numbers';
end $$;
select t.as_('maya');
insert into t.snap values ('before', public.admin_launch_metrics());
reset role;

-- ---------- Rows that should move each number (inserted directly, so no trigger rewrites their dates) ----------
set local session_replication_role = replica;
-- Signed this week.
insert into public.milestones (id, project_id, owner_id, community_id, title, status, reviewed_at, created_at)
values ('lm-now', 'p1', :'ben', 'rkt', 'Signed this week', 'verified', now(), now() - interval '1 hour');
-- Asked by the club nine days ago, signed 20 hours later: within 48 hours, and before this week (over
-- eight days ago is always before this week's Monday), so it doesn't move this week's count.
insert into public.milestones (id, project_id, owner_id, community_id, title, status, reviewed_at, created_at)
values ('lm-fast', 'p1', :'ben', 'rkt', 'Signed fast', 'verified', now() - interval '9 days' + interval '20 hours', now() - interval '9 days');
insert into public.verification_events (milestone_id, community_id, actor_id, action, created_at)
values ('lm-fast', 'rkt', :'ben', 'submitted', now() - interval '9 days');
-- Asked by email four days ago, still waiting.
insert into public.milestones (id, project_id, owner_id, community_id, title, status, created_at)
values ('lm-wait', 'p1', :'ben', 'rkt', 'Still waiting', 'pending', now() - interval '4 days');
insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash, created_at)
values ('lm-wait', :'ben', 'prof.lee@utexas.edu', 'professor', repeat('a', 64), now() - interval '4 days');
-- Asked an hour ago: too new to count either way.
insert into public.milestones (id, project_id, owner_id, community_id, title, status, created_at)
values ('lm-new', 'p1', :'ben', 'rkt', 'Just asked', 'pending', now() - interval '1 hour');
insert into public.verification_events (milestone_id, community_id, actor_id, action, created_at)
values ('lm-new', 'rkt', :'ben', 'submitted', now() - interval '1 hour');
-- Josh: a first result 60 days ago and a second 50 days ago (within 30 days of the first).
delete from public.milestones where owner_id = :'josh';
insert into public.milestones (id, project_id, owner_id, community_id, title, status, created_at)
values ('lm-j1', 'p1', :'josh', 'rkt', 'First', 'pending', now() - interval '60 days'),
       ('lm-j2', 'p1', :'josh', 'rkt', 'Second', 'pending', now() - interval '50 days');
set local session_replication_role = origin;

select t.as_('maya'); set local role authenticated;
insert into t.snap values ('after', public.admin_launch_metrics());
reset role;

select t.ok(jsonb_array_length((select v->'signed_weeks' from t.snap where k = 'after')) = 8, 'eight weeks of signed results');
select t.ok(((select v->'signed_weeks'->7->>'signed' from t.snap where k = 'after')::int
           - (select v->'signed_weeks'->7->>'signed' from t.snap where k = 'before')::int) = 1, 'a result signed this week counts in this week');
select t.ok(((select v->>'asked' from t.snap where k = 'after')::int - (select v->>'asked' from t.snap where k = 'before')::int) = 2,
  'asks from 30 days to 48 hours ago count (a club ask and an email ask), and an ask from an hour ago doesn''t');
select t.ok(((select v->>'signed_48h' from t.snap where k = 'after')::int - (select v->>'signed_48h' from t.snap where k = 'before')::int) = 1,
  'only the one signed within 48 hours counts as signed within 48 hours');
select t.ok((select (v->>'median_hours_ask_to_sign')::numeric > 0 from t.snap where k = 'after'), 'the median hours to a signature is there');
select t.ok(((select v->>'first_results' from t.snap where k = 'after')::int - (select v->>'first_results' from t.snap where k = 'before')::int) = 1
        and ((select v->>'second_within_30d' from t.snap where k = 'after')::int - (select v->>'second_within_30d' from t.snap where k = 'before')::int) = 1,
  'a member whose first result was 60 days ago and second 10 days later counts as a second result');
select t.ok((select (v->>'companies_looked_and_wrote')::int <= least((v->>'companies_looked')::int, (v->>'companies_wrote')::int)
                and (v->>'companies_looked')::int <= (v->>'companies_verified')::int from t.snap where k = 'after'),
  'companies that looked and wrote are counted within those that looked and those that wrote');

\echo 'launch-metrics: all passed'
rollback;
