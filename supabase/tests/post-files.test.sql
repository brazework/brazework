-- Tests for supabase/post-files.sql: any post's author can add files to it; everyone who sees the post
-- sees them, but only through the app (Storage keeps the original to the uploader). Runs in one
-- transaction and rolls back. Needs the e2e seed (Ben and Cara).
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false);

create schema t;
grant usage on schema t to authenticated;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.refused(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
grant execute on all functions in schema t to authenticated;

-- Ben's post (made directly, as members can't choose a post's id).
select t.as_('ben');
insert into public.posts (id, author_id, body, kind) values ('pf-post-e2e', :'ben', 'Bracket v2 is printed', 'update');
set local role authenticated;
insert into public.post_files (post_id, kind, name, path, size) values ('pf-post-e2e', 'file', 'bracket.stl', 'pf-post-e2e/aaaaaaaa-bracket.stl', 1000);
select t.ok((select added_by = auth.uid() from public.post_files where post_id = 'pf-post-e2e'), 'the author adds a file to their own post');
select t.ok(t.refused($q$insert into public.post_files (post_id, kind, name, path, size) values ('pf-post-e2e', 'file', 'x.exe', 'pf-post-e2e/bbbbbbbb-x.exe', 10)$q$), 'a file type projects don''t accept is refused');

select t.as_('cara');
select t.ok((select count(*) from public.post_files where post_id = 'pf-post-e2e') = 1, 'someone who sees the post sees its file');
select t.ok(public.post_file_access((select id from public.post_files where post_id = 'pf-post-e2e')) = 'view', 'and may view it through the app');
select t.ok(t.refused($q$insert into public.post_files (post_id, kind, name, url) values ('pf-post-e2e', 'link', 'mine', 'https://example.com')$q$), 'someone else can''t add to the post');
with d as (delete from public.post_files where post_id = 'pf-post-e2e' returning 1) select t.ok((select count(*) from d) = 0, 'or remove from it');
select t.ok(public.post_file_access(-1) = 'none', 'a file that doesn''t exist is none');
reset role;

-- Storage, where it's installed: the original is the uploader's only.
do $$
declare n int;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    raise notice 'ok: no Storage here, skipping the bucket checks';
    return;
  end if;
  insert into storage.objects (bucket_id, name, owner_id) values ('post-files', 'pf-post-e2e/aaaaaaaa-bracket.stl', current_setting('t.ben'));
  perform set_config('request.jwt.claim.sub', current_setting('t.cara'), true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'post-files' and name = 'pf-post-e2e/aaaaaaaa-bracket.stl';
  reset role;
  perform t.ok(n = 0, 'someone else can''t read the original from Storage');
  perform set_config('request.jwt.claim.sub', current_setting('t.ben'), true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'post-files' and name = 'pf-post-e2e/aaaaaaaa-bracket.stl';
  reset role;
  perform t.ok(n = 1, 'the uploader can');
end $$;

\echo 'post-files: all passed'
rollback;
