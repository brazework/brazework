-- Tests for supabase/pro-storage.sql: a project's files take videos up to 250 MB and everything else
-- up to 50 MB; the buckets (where Storage is installed) allow 250 MB. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.ben', :'ben', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- Ben owns p1. A 200 MB video goes in; so does a 40 MB PDF.
select t.as_('ben'); set local role authenticated;
insert into public.project_files (project_id, name, kind, path, size) values ('p1', 'Static fire.mp4', 'file', 'p1/9a8b7c6d-1111-4222-8333-444455556666.mp4', 200 * 1048576);
select t.ok((select count(*) = 1 from public.project_files where path = 'p1/9a8b7c6d-1111-4222-8333-444455556666.mp4'), 'a 200 MB video is accepted');
insert into public.project_files (project_id, name, kind, path, size) values ('p1', 'Report.pdf', 'file', 'p1/9a8b7c6d-1111-4222-8333-444455556667.pdf', 40 * 1048576);
select t.ok((select count(*) = 1 from public.project_files where path = 'p1/9a8b7c6d-1111-4222-8333-444455556667.pdf'), 'a 40 MB PDF is accepted');

-- A 60 MB PDF is refused (only videos go past 50 MB), and so is a video over 250 MB.
do $$ begin
  insert into public.project_files (project_id, name, kind, path, size) values ('p1', 'Big.pdf', 'file', 'p1/9a8b7c6d-1111-4222-8333-444455556668.pdf', 60 * 1048576);
  raise exception 'FAILED: a 60 MB PDF was accepted';
exception when check_violation then raise notice 'ok: a 60 MB PDF is refused';
end $$;
do $$ begin
  insert into public.project_files (project_id, name, kind, path, size) values ('p1', 'Huge.mov', 'file', 'p1/9a8b7c6d-1111-4222-8333-444455556669.mov', 251 * 1048576);
  raise exception 'FAILED: a 251 MB video was accepted';
exception when check_violation then raise notice 'ok: a video over 250 MB is refused';
end $$;
-- A link has no size and still goes in.
insert into public.project_files (project_id, name, kind, url) values ('p1', 'Drawings', 'link', 'https://example.com/drawings');
select t.ok((select count(*) = 1 from public.project_files where project_id = 'p1' and name = 'Drawings'), 'links have no size and are unaffected');

reset role;
select t.ok(public.project_file_size_ok('p1/x.MP4', 262144000), 'the extension check ignores case');
select t.ok(not public.project_file_size_ok('p1/x.zip', 52428801), 'other files stop at 50 MB');

-- The buckets, where Storage is installed (the local stack has it; the CI database doesn't).
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    perform t.ok((select file_size_limit = 262144000 from storage.buckets where id = 'media'), 'the media bucket allows 250 MB');
    perform t.ok((select 'video/mp4' = any (allowed_mime_types) and not ('text/html' = any (allowed_mime_types)) from storage.buckets where id = 'media'), 'the media bucket still only takes photos and video');
    perform t.ok((select file_size_limit = 262144000 and allowed_mime_types is null from storage.buckets where id = 'project-files'), 'the project-files bucket allows 250 MB (types by extension)');
  end if;
end $$;

select t.ok(public.pro_storage_ready(), 'the app can tell the step has run');

rollback;
\echo 'pro-storage tests: all passed'
