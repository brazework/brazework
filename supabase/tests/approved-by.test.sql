-- Tests for supabase/approved-by.sql: a backed pull request keeps who approved it on GitHub. Names are
-- kept only for a public repo; a private repo keeps the count alone; only a pull request has
-- approvals; nothing that isn't a GitHub login can be stored; members never write any of it; other
-- members and the public share card read it with the backing. Runs in one transaction; rolls back.
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
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- Ben logs three milestones, asking nobody, and shows them.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, evidence, status, private) values
  ('p1', null, 'Checkout p95 down to 310 ms', 'https://github.com/acme/checkout/pull/1187', 'logged', false),
  ('p1', null, 'Ledger cutover', 'https://github.com/acme/ledger/pull/77', 'logged', false),
  ('p1', null, 'Parser commit', 'https://github.com/acme/checkout/commit/abcdef1', 'logged', false);
reset role;
select id as pub from public.milestones where title = 'Checkout p95 down to 310 ms' \gset
select id as prv from public.milestones where title = 'Ledger cutover' \gset
select id as cmt from public.milestones where title = 'Parser commit' \gset
select set_config('t.pub', :'pub', false), set_config('t.prv', :'prv', false), set_config('t.cmt', :'cmt', false);

-- The server records the backings (service role: here, the table owner).
insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id, approvals, approvers, repo_private)
values (:'pub', 'pull_request', 'https://github.com/acme/checkout/pull/1187', 'acme/checkout', '1187', 501, 2, '{sam-rivera,lee-park}', false);
insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id, approvals, approvers, repo_private)
values (:'prv', 'pull_request', 'https://github.com/acme/ledger/pull/77', 'acme/ledger', '77', 501, 3, '{}', true);
-- A backing recorded the old way (an app deployed before this step) still works, with no approvals.
insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id)
values (:'cmt', 'commit', 'https://github.com/acme/checkout/commit/abcdef1', 'acme/checkout', 'abcdef1', 501);
select t.ok((select approvals = 0 and approvers = '{}' and repo_private from public.milestone_backings where milestone_id = :'cmt'), 'a backing with nothing said has no approvals and counts as private');

-- What can't be stored.
select t.refused($$update public.milestone_backings set approvers = '{sam-rivera}' where milestone_id = current_setting('t.prv')$$, '23514', 'a private repo''s reviewers are never named');
select t.refused($$update public.milestone_backings set approvers = '{a,b,c}' where milestone_id = current_setting('t.pub')$$, '23514', 'no more names than approvals');
select t.refused($$update public.milestone_backings set approvals = 1 where milestone_id = current_setting('t.cmt')$$, '23514', 'only a pull request has approvals');
select t.refused($$update public.milestone_backings set approvals = 100 where milestone_id = current_setting('t.prv')$$, '23514', 'the count is bounded');
select t.refused($$update public.milestone_backings set approvers = '{"<script>","lee-park"}' where milestone_id = current_setting('t.pub')$$, '23514', 'only GitHub logins: no markup');
select t.refused($$update public.milestone_backings set approvers = '{"sam rivera","lee-park"}' where milestone_id = current_setting('t.pub')$$, '23514', 'no spaces');
select t.refused($$update public.milestone_backings set approvers = '{"-sam","lee-park"}' where milestone_id = current_setting('t.pub')$$, '23514', 'not starting with a hyphen');

-- Members never write it, not even their own.
select t.as_('ben'); set local role authenticated;
select t.refused($$update public.milestone_backings set approvals = 9 where milestone_id = current_setting('t.pub')$$, '42501', 'a member can''t add approvals to their own backing');
reset role;

-- Another member reads the approvals with the backing.
select t.as_('maya'); set local role authenticated;
select approvals as n, array_to_string(approvers, ',') as who from public.milestone_backings where milestone_id = current_setting('t.pub') \gset
select approvals as pn, cardinality(approvers) as pwho from public.milestone_backings where milestone_id = current_setting('t.prv') \gset
reset role;
select t.ok(:n = 2 and :'who' = 'sam-rivera,lee-park', 'other members see who approved a public pull request');
select t.ok(:pn = 3 and :pwho = 0, 'and only how many approved a private one');

-- The public share card carries them too, once Ben shares it.
select t.as_('ben'); set local role authenticated;
select public.share_milestone(:'pub', true);
select public.share_milestone(:'prv', true);
reset role;
set local role anon;
select public.public_proof(:'pub') as card \gset
select public.public_proof(:'prv') as pcard \gset
reset role;
select t.ok(:'card'::jsonb ->> 'level' = 'backed' and (:'card'::jsonb -> 'backing' ->> 'approvals')::int = 2 and :'card'::jsonb -> 'backing' -> 'approvers' = '["sam-rivera", "lee-park"]'::jsonb,
  'the public card says who approved it, and stays "backed", never "signed"');
select t.ok((:'pcard'::jsonb -> 'backing' ->> 'approvals')::int = 3 and :'pcard'::jsonb -> 'backing' -> 'approvers' = '[]'::jsonb and :'pcard' not like '%sam%', 'a private repo''s card gives the count and no names');

\echo 'approved-by: all passed'
rollback;
