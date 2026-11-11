-- Tests for supabase/media-keys.sql: post media may carry the file's size (bytes) and a video's
-- poster frame; bad values are still refused. The first check is the production failure from FIX-75:
-- a post whose photo carries bytes must save. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.m(j text) returns boolean language sql as $$ select public.post_media_ok(replace(j, 'BEN', current_setting('t.ben'))::jsonb, current_setting('t.ben')::uuid) $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- What the app saves since FIX-75: a photo with its size. It has to post.
select t.as_('ben'); set local role authenticated;
insert into public.posts (body, media) values ('Static fire photo', replace('[{"type":"image","path":"BEN/0d556903-fbb4-4c0d-8038-000000000001.webp","w":2000,"h":1500,"bytes":412345}]', 'BEN', current_setting('t.ben'))::jsonb);
select t.ok(true, 'a photo post carrying its size saves');
reset role;

select t.ok(t.m('[{"type":"video","path":"BEN/0d556903-fbb4-4c0d-8038-000000000002.mp4","bytes":180000000,"poster":"BEN/0d556903-fbb4-4c0d-8038-000000000003.webp"}]'), 'a 180 MB video with its poster');
select t.ok(not t.m('[{"type":"video","path":"BEN/0d556903-fbb4-4c0d-8038-000000000002.mp4","bytes":300000000}]'), 'over 250 MB is refused');
select t.ok(not t.m('[{"type":"image","path":"BEN/0d556903-fbb4-4c0d-8038-000000000001.webp","bytes":-1}]'), 'a negative size is refused');
select t.ok(not t.m('[{"type":"image","path":"BEN/0d556903-fbb4-4c0d-8038-000000000001.webp","bytes":1.5}]'), 'a fractional size is refused');
select t.ok(not t.m('[{"type":"image","path":"BEN/0d556903-fbb4-4c0d-8038-000000000001.webp","poster":"BEN/0d556903-fbb4-4c0d-8038-000000000003.webp"}]'), 'a poster on a photo is refused');
select t.ok(not t.m('[{"type":"video","path":"BEN/0d556903-fbb4-4c0d-8038-000000000002.mp4","poster":"BEN/0d556903-fbb4-4c0d-8038-000000000003.png"}]'), 'a poster must be WebP');
select t.ok(not public.post_media_ok(('[{"type":"video","path":"' || current_setting('t.ben') || '/0d556903-fbb4-4c0d-8038-000000000002.mp4","poster":"' || current_setting('t.maya') || '/0d556903-fbb4-4c0d-8038-000000000003.webp"}]')::jsonb, current_setting('t.ben')::uuid), 'a poster from someone else''s folder is refused');
select t.ok(not t.m('[{"type":"image","path":"BEN/0d556903-fbb4-4c0d-8038-000000000001.webp","sneaky":1}]'), 'unknown keys are still refused');
select t.ok(public.media_keys_ready(), 'the app can tell the step has run');

rollback;
\echo 'media-keys tests: all passed'
