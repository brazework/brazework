-- Tests for supabase/money.sql: nobody can give themselves Plus (only the webhook's service key writes
-- member_plans); has_plus() is the one flag; who looked is 7 days on Free and 90 with Plus, named by
-- company; request_sales() files a request for the founders as the signed-in member, with their
-- account email and no address typed, once a day per ask and at most 5 a day; members can't read the
-- admin queue. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false);

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

-- Cara runs a verified company; she looked at Ben's profile 2 days ago and 20 days ago.
insert into public.organizations (id, type, name, domain) values ('mny-acme', 'company', 'Acme Robotics', 'acme-mny.test');
insert into public.organization_admins (org_id, uid) values ('mny-acme', :'cara');
insert into public.profile_views (profile_id, viewer, day, viewed_at) values
  (:'ben', :'cara', current_date - 20, now() - interval '20 days');
insert into public.organizations (id, type, name, domain) values ('mny-zeta', 'company', 'Zeta Labs', 'zeta-mny.test');

-- ---------- Plus ----------
select t.as_('ben'); set local role authenticated;
select t.ok(not public.has_plus(), 'a member starts without Plus');
select t.refused($$insert into public.member_plans (user_id) values (current_setting('t.ben')::uuid)$$, '42501', 'nobody can give themselves Plus');
select public.my_company_viewers(90) as free \gset
reset role;
select t.ok((:'free'::jsonb ->> 'days')::int = 7, 'on Free, who looked covers 7 days even when 90 are asked for');
select t.ok(:'free'::jsonb -> 'companies' = '[]'::jsonb, 'so a company that looked 20 days ago isn''t shown');

-- The webhook (service key) records a paid Plus checkout.
insert into public.member_plans (user_id, plan, status, provider_ref) values (:'ben', 'plus', 'active', 'sub_test');
select t.as_('ben'); set local role authenticated;
select t.ok(public.has_plus(), 'after checkout, has_plus() is true');
select public.my_company_viewers(90) as plus \gset
reset role;
select t.ok((:'plus'::jsonb ->> 'days')::int = 90, 'with Plus, who looked covers 90 days');
select t.ok(:'plus'::jsonb -> 'companies' @> '[{"name": "Acme Robotics"}]'::jsonb, 'and names the company that looked 20 days ago');
select t.ok(position('Cara' in :'plus') = 0, 'by company, never by person');
select t.as_('cara'); set local role authenticated;
select t.ok(not public.has_plus(), 'Plus is Ben''s alone');
select count(*) as seen from public.member_plans \gset
reset role;
select t.ok(:'seen' = 0, 'and Cara can''t see his plan');
update public.member_plans set status = 'canceled' where user_id = :'ben';
select t.as_('ben'); set local role authenticated;
select t.ok(not public.has_plus(), 'a canceled subscription ends Plus');
reset role;

-- ---------- Requests for the founders ----------
set local role anon;
select t.refused($$select public.request_sales('talent', 'Acme', '', '')$$, '42501', 'signed out, a request can''t be made');
reset role;
select t.as_('cara'); set local role authenticated;
select t.refused($$select public.request_sales('free money', 'Acme', '', '')$$, 'P0001', 'only the known kinds');
select t.refused($$select public.request_sales('talent', ' ', '', '')$$, 'P0001', 'a company request names the company');
select public.request_sales('talent', 'Acme   Robotics', '', 'Three recruiters, spring interns') as r1 \gset
select public.request_sales('talent', 'Acme Robotics', '', 'again') as r2 \gset
select public.request_sales('chapter', 'Acme Robotics', 'rkt', '') as r3 \gset
select public.request_sales('plus', '', '', '') as r4 \gset
select count(*) as visible from public.admin_queue \gset
reset role;
select t.ok(:'r1' = 'requested' and :'r2' = 'already', 'the same ask twice in a day is one');
select t.ok(:'r3' = 'requested' and :'r4' = 'requested', 'another kind is its own request; the Plus waitlist needs no company');
select t.ok(:'visible' = 0, 'members can''t read the admin queue');
select t.ok((select detail from public.admin_queue where kind = 'sales' and subject_id = :'cara' and detail like 'Find builders%')
  = 'Find builders: search seats · Cara Diaz <cara@forge.test> · Acme Robotics · "Three recruiters, spring interns"', 'the founders see who, their account email, the company and the note');
select t.ok((select community_id = 'rkt' and detail like '%for Rocketry Club%' from public.admin_queue where kind = 'sales' and detail like 'Sponsor a chapter%'), 'a chapter sponsorship names the club');
select t.as_('cara'); set local role authenticated;
select public.request_sales('school', 'State U', '', '');
select public.request_sales('challenge', 'Acme Robotics', '', '');
select t.refused($$select public.request_sales('chapter', 'Acme Robotics', 'rob', '')$$, 'P0001', 'at most 5 a day');
reset role;

\echo 'money: all passed'
rollback;
