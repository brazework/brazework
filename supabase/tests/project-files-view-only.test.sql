-- Tests for supabase/project-files-view-only.sql: outside a project's team, documents and 3D models are
-- view-only (no original from Storage); photos and videos are unchanged. Runs in one transaction and
-- rolls back. Needs the e2e seed (Ben owns the public project p1; Cara isn't on it).
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
grant execute on all functions in schema t to authenticated;

insert into public.project_files (project_id, added_by, kind, name, path, size)
  values ('p1', :'ben', 'file', 'stand.stl', 'p1/vo-stand.stl', 1000), ('p1', :'ben', 'file', 'write-up.pdf', 'p1/vo-writeup.pdf', 1000);
select id as stl from public.project_files where path = 'p1/vo-stand.stl' \gset
insert into public.projects (id, owner_id, title, summary, private) values ('vo-secret', :'ben', 'Stealth', 'Not yet.', true);
insert into public.project_files (project_id, added_by, kind, name, path, size) values ('vo-secret', :'ben', 'file', 'secret.pdf', 'vo-secret/vo-secret.pdf', 1000);
select id as secret from public.project_files where path = 'vo-secret/vo-secret.pdf' \gset
select set_config('t.stl', :'stl', false), set_config('t.secret', :'secret', false);

set local role authenticated;
select t.as_('ben');
select t.ok(public.project_file_access(current_setting('t.stl')::bigint) = 'download', 'the owner may download the original');
select t.as_('cara');
select t.ok(public.project_file_access(current_setting('t.stl')::bigint) = 'view', 'someone outside the team may only view it');
select t.ok(public.project_file_access(current_setting('t.secret')::bigint) = 'none', 'a private project''s file isn''t even viewable');
select t.ok(public.project_file_access(-1) = 'none', 'a file that doesn''t exist is none');
reset role;

-- Storage: where it's installed, the original of a model or document is out of reach outside the team.
do $$
declare n_doc int; n_pic int;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    raise notice 'ok: no Storage here, skipping the bucket checks';
    return;
  end if;
  insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false) on conflict (id) do nothing;
  insert into storage.objects (bucket_id, name, owner_id) values ('project-files', 'p1/vo-stand.stl', current_setting('t.ben')), ('project-files', 'p1/vo-photo.png', current_setting('t.ben'));
  perform set_config('request.jwt.claim.sub', current_setting('t.cara'), true);
  set local role authenticated;
  select count(*) into n_doc from storage.objects where bucket_id = 'project-files' and name = 'p1/vo-stand.stl';
  select count(*) into n_pic from storage.objects where bucket_id = 'project-files' and name = 'p1/vo-photo.png';
  reset role;
  perform t.ok(n_doc = 0, 'outside the team, the model''s original can''t be read from Storage');
  perform t.ok(n_pic = 1, 'a photo on the same project still can');
  perform set_config('request.jwt.claim.sub', current_setting('t.ben'), true);
  set local role authenticated;
  select count(*) into n_doc from storage.objects where bucket_id = 'project-files' and name = 'p1/vo-stand.stl';
  reset role;
  perform t.ok(n_doc = 1, 'the owner can still read the original');
end $$;

\echo 'project-files-view-only: all passed'
rollback;
