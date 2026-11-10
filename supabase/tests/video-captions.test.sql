-- Tests for supabase/video-captions.sql: what post_media_ok() accepts for captions and transcripts.
-- Runs in one transaction and rolls back.
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.media(extra jsonb, kind text default 'video') returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('type', kind, 'path', current_setting('t.josh') || '/clip.mp4') || extra) $$;

select t.ok(public.post_media_ok(t.media('{}'), current_setting('t.josh')::uuid), 'a plain video is still fine');
select t.ok(public.post_media_ok(t.media(jsonb_build_object('cc', E'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nIgnition.')), current_setting('t.josh')::uuid), 'a video with WebVTT captions');
select t.ok(public.post_media_ok(t.media('{"tx": "Countdown, ignition, liftoff."}'), current_setting('t.josh')::uuid), 'a video with a transcript');
select t.ok(not public.post_media_ok(t.media('{"cc": "1\n00:00:01,000 --> 00:00:03,000\nSRT, not converted"}'), current_setting('t.josh')::uuid), 'captions must be WebVTT');
select t.ok(not public.post_media_ok(t.media('{"cc": "WEBVTT\n\nno cues at all"}'), current_setting('t.josh')::uuid), 'captions need at least one cue');
select t.ok(not public.post_media_ok(t.media(jsonb_build_object('cc', 'WEBVTT --> ' || repeat('x', 20000))), current_setting('t.josh')::uuid), 'captions have a size limit');
select t.ok(not public.post_media_ok(t.media(jsonb_build_object('tx', repeat('x', 5001))), current_setting('t.josh')::uuid), 'transcripts have a size limit');
select t.ok(not public.post_media_ok(t.media('{"tx": "   "}'), current_setting('t.josh')::uuid), 'an empty transcript isn''t stored');
select t.ok(not public.post_media_ok(t.media(jsonb_build_object('cc', E'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx'), 'image'), current_setting('t.josh')::uuid), 'photos can''t carry captions');
select t.ok(not public.post_media_ok(t.media('{"zz": 1}'), current_setting('t.josh')::uuid), 'other unknown keys are still refused');
select t.ok(public.video_captions_ready(), 'the app can tell the step has run');

rollback;
\echo 'video-captions tests: all passed'
