-- Tests for supabase/plus-teaser.sql: on Free, who looked names the last 7 days and counts, without
-- naming, the verified companies from the 90 days before; the count is exact (one company that looked
-- twice is one), suspended companies never count, and with Plus nothing is hidden. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Cara runs a verified company and looked at Ben 20 days ago; Josh runs a suspended one and looked 30 days ago.
insert into public.organizations (id, type, name, domain, verification_status) values
  ('pt-acme', 'company', 'Acme Teaser', 'acme-pt.test', 'verified'),
  ('pt-shady', 'company', 'Suspended Co', 'shady-pt.test', 'suspended');
insert into public.organization_admins (org_id, uid) values ('pt-acme', :'cara'), ('pt-shady', :'josh');
-- Start from no views of Ben, so only the ones below count (the transaction rolls this back).
delete from public.profile_views where profile_id = :'ben';
insert into public.profile_views (profile_id, viewer, day, viewed_at) values
  (:'ben', :'cara', current_date - 20, now() - interval '20 days'),
  (:'ben', :'josh', current_date - 30, now() - interval '30 days');

-- Cara and Josh may already run companies in the test data, so the expected count is every verified
-- company either of them runs: what Ben's 90 days really hold, none of it in his 7-day window.
select count(distinct o.name) as expect from public.organization_admins a join public.organizations o on o.id = a.org_id
 where a.uid in (:'cara', :'josh') and o.type = 'company' and o.verification_status = 'verified' \gset
select t.ok(:'expect'::int >= 1, 'at least one verified company looked');

select t.as_('ben'); set local role authenticated;
select public.my_company_viewers(90) as a \gset
reset role;
select t.ok(:'a'::jsonb -> 'companies' = '[]'::jsonb, 'on Free, a company from 20 days ago isn''t named');
select t.ok((:'a'::jsonb ->> 'hidden')::int = :'expect'::int, 'but each verified company that looked is counted, exactly');
select t.ok(position('Acme' in :'a') = 0 and position('Suspended' in :'a') = 0, 'the count never names anyone');

-- Cara looks again today: now she's shown, and the same company isn't counted twice.
insert into public.profile_views (profile_id, viewer, day, viewed_at) values (:'ben', :'cara', current_date, now());
select t.as_('ben'); set local role authenticated;
select public.my_company_viewers(90) as b \gset
reset role;
select t.ok(:'b'::jsonb -> 'companies' @> '[{"name": "Acme Teaser"}]'::jsonb, 'a company that looked this week is named');
select count(distinct o.name) as rest from public.organization_admins a join public.organizations o on o.id = a.org_id
 where a.uid = :'josh' and o.type = 'company' and o.verification_status = 'verified'
   and o.name not in (select o2.name from public.organization_admins a2 join public.organizations o2 on o2.id = a2.org_id where a2.uid = :'cara') \gset
select t.ok((:'b'::jsonb ->> 'hidden')::int = :'rest'::int, 'a company shown this week isn''t also counted as hidden');

-- With Plus, everything is shown and nothing is hidden.
delete from public.profile_views where profile_id = :'ben' and viewer = :'cara' and viewed_at > now() - interval '1 day';
insert into public.member_plans (user_id, plan, status, provider_ref) values (:'ben', 'plus', 'active', 'sub_pt');
select t.as_('ben'); set local role authenticated;
select public.my_company_viewers(90) as c \gset
reset role;
select t.ok(:'c'::jsonb -> 'companies' @> '[{"name": "Acme Teaser"}]'::jsonb and (:'c'::jsonb ->> 'hidden')::int = 0, 'with Plus, the company from 20 days ago is named and nothing is hidden');
select t.ok(position('Suspended' in :'c') = 0, 'a suspended company never shows, even with Plus');

\echo 'plus-teaser: all passed'
rollback;
