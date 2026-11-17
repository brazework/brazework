-- Tests for supabase/backed.sql: a member can log a milestone with nobody asked to sign it; it stays
-- theirs alone until the server records that GitHub backs it; then it shows to other members while
-- they keep it public and it isn't revoked. Members can never write a backing themselves. Asking a
-- club works exactly as before. Runs in one transaction; rolls back.
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

-- Ben logs a milestone on his project, asking nobody, and shows it on his profile.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, evidence, status, private)
values ('p1', 'rkt', 'Thrust logger merged', 'https://github.com/bencho/test-stand/pull/12', 'logged', false);
reset role;
select id as ms from public.milestones where title = 'Thrust logger merged' \gset
select set_config('t.ms', :'ms', false);
select t.ok((select status = 'logged' and community_id is null and community_name = '' from public.milestones where id = :'ms'), 'a logged milestone asks nobody, even if a club was named');

-- Not backed yet: only Ben sees it, and no club's officers get it.
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 0 from public.milestones where id = current_setting('t.ms')), 'a logged milestone isn''t shown to others before it''s backed');
reset role;

-- Members can't back their own work.
select t.as_('ben'); set local role authenticated;
select t.refused($$insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id) values (current_setting('t.ms'), 'pull_request', 'https://github.com/bencho/test-stand/pull/12', 'bencho/test-stand', '12', 501)$$, '42501', 'a member can''t write a backing');
reset role;

-- The server records the backing (service role: here, the table owner).
insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id)
values (:'ms', 'pull_request', 'https://github.com/bencho/test-stand/pull/12', 'bencho/test-stand', '12', 501);

select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 1 from public.milestones where id = current_setting('t.ms') and status = 'logged'), 'once backed, other members see it');
select t.ok((select count(*) = 1 from public.milestone_backings where milestone_id = current_setting('t.ms') and kind = 'pull_request'), 'and they see what backs it');
reset role;

-- Hidden by Ben, or revoked: gone again, backing and all.
update public.milestones set private = true where id = :'ms';
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 0 from public.milestones where id = current_setting('t.ms')), 'a hidden backed milestone stays hidden');
select t.ok((select count(*) = 0 from public.milestone_backings where milestone_id = current_setting('t.ms')), 'and so does its backing');
reset role;
update public.milestones set private = false, status = 'revoked' where id = :'ms';
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 0 from public.milestones where id = current_setting('t.ms')), 'a revoked milestone never shows, even backed');
reset role;
update public.milestones set status = 'refused', review_note = 'We didn''t see it run' where id = :'ms';
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 0 from public.milestones where id = current_setting('t.ms')), 'a refused milestone stays private, backing or not: its note never leaks');
reset role;

-- The same pull request can't back a second milestone.
select t.refused($$insert into public.milestone_backings (milestone_id, kind, url, repo_full_name, ref, github_user_id) select id, 'pull_request', 'https://github.com/bencho/test-stand/pull/12', 'BenCho/Test-Stand', '12', 501 from public.milestones where id = 'm1'$$, '23505', 'one piece of work backs one milestone');

-- Logging doesn't fill the queue: logged milestones aren't counted among the 20 waiting.
select t.ok((select count(*) = 0 from public.milestones where status = 'logged' and community_id is not null), 'no logged milestone sits in a club''s queue');

-- Asking a club works as before, and anything but draft or logged still becomes pending.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, evidence, status)
values ('p1', 'rkt', 'Second static fire', 'https://example.com/video', 'verified');
select t.ok((select status = 'pending' and community_id = 'rkt' from public.milestones where title = 'Second static fire'), 'nobody can insert themselves verified; asking a club is unchanged');
select t.refused($$insert into public.milestones (project_id, title, status) values ('p1', 'No evidence', 'logged')$$, 'P0001', 'a logged milestone still needs evidence');

reset role;

-- Ben can remove his logged milestone.
update public.milestones set status = 'logged' where id = :'ms';
select t.as_('ben'); set local role authenticated;
delete from public.milestones where id = current_setting('t.ms');
select t.ok((select count(*) = 0 from public.milestones where id = current_setting('t.ms')), 'the owner can remove a logged milestone');
reset role;
select t.ok((select count(*) = 0 from public.milestone_backings where milestone_id = :'ms'), 'its backing goes with it');

rollback;
\echo 'backed tests: all passed'
