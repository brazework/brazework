-- Tests for supabase/feed-pages.sql: feed_page() returns the same posts row-level security allows a
-- direct read, page after page with no repeats or gaps (even when many posts share a timestamp), keeps
-- blocked, held and private-club posts out, says correctly what you liked and saved, carries the latest
-- two replies, ranks For you and then carries on past 30 days, and runs as the caller (not definer).
-- Also: the counters match, and a post's tiny placeholder must be a WebP data: URI. Runs in one
-- transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.josh', :'josh', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
-- Every page of a feed, following "next" until it ends: the ids in order.
create function t.walk(tab text, srt text, kind text default '', community text default null) returns text[] language plpgsql as $$
declare r jsonb; cur jsonb := null; asof timestamptz := null; out text[] := '{}'; n int := 0;
begin
  loop
    r := public.feed_page(tab, srt, kind, '', community, cur, asof, 7);
    asof := (r->>'as_of')::timestamptz;
    out := out || coalesce((select array_agg(x->>'id' order by o) from jsonb_array_elements(r->'items') with ordinality e(x, o)), '{}');
    cur := r->'next';
    n := n + 1;
    exit when cur is null or cur = 'null'::jsonb or n > 60;
  end loop;
  return out;
end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- 30 public posts sharing one timestamp (the tie-break is the id), a held club post, a private club's
-- post, a post by someone Ben blocks, and an old post (40 days) past For you's ranked window.
insert into public.posts (author_id, body, kind, tags, created_at)
  select case g % 3 when 0 then :'josh'::uuid when 1 then :'maya'::uuid else :'cara'::uuid end, 'Same-second post ' || g, 'update', '{Aerospace}', '2026-11-01 12:00:00+00'
  from generate_series(1, 30) g;
insert into public.posts (author_id, body, kind, created_at) select :'josh'::uuid, 'Old post from last month', 'result', now() - interval '40 days';
insert into public.communities (id, name, type, privacy, owner_id, about) values ('secretclub', 'Secret Club', 'project', 'approval', :'maya', 'Members only.');
insert into public.community_members (community_id, uid, role) values ('secretclub', :'maya', 'owner');
insert into public.posts (author_id, body, kind, community_id, created_at) values (:'maya', 'Members-only post', 'update', 'secretclub', now() - interval '1 hour');
insert into public.posts (author_id, body, kind, community_id, status, created_at) values (:'josh', 'Held for review', 'update', 'rkt', 'held', now() - interval '2 hours');
insert into public.posts (id, author_id, body, kind, created_at) values ('blockedpost', :'cara', 'From someone Ben blocks', 'update', now() - interval '30 minutes');
insert into public.message_blocks (blocker, blocked) values (:'ben', :'cara');
-- A post with likes and three replies, to check the flags, counts and previews.
insert into public.posts (id, author_id, body, kind, created_at) values ('liked1', :'josh', 'Liked and replied', 'update', now() - interval '10 minutes');

reset role; select t.as_('ben'); set local role authenticated;
insert into public.likes (post_id) values ('liked1');
insert into public.saved (post_id) values ('liked1');
insert into public.comments (post_id, body) values ('liked1', 'First reply');
reset role; select t.as_('maya'); set local role authenticated;
insert into public.likes (post_id) values ('liked1');
insert into public.comments (post_id, body) values ('liked1', 'Second reply');
insert into public.comments (post_id, body) values ('liked1', 'Third reply');
-- Replies made in one transaction share now(); spread them out like real ones.
reset role;
update public.comments set created_at = now() - make_interval(mins => case body when 'First reply' then 3 when 'Second reply' then 2 else 1 end) where post_id = 'liked1';

-- ---------- Latest: every page together is exactly what a direct read returns ----------
reset role; select t.as_('ben'); set local role authenticated;
select t.ok((select t.walk('latest', 'new') = (select array_agg(id order by created_at desc, id desc) from public.posts where community_id is null)),
  'Latest, page by page, is exactly the public posts Ben may read, newest first, no repeats or gaps');
select t.ok((select cardinality(t.walk('latest', 'new')) = (select count(distinct x) from unnest(t.walk('latest', 'new')) x)), 'no post repeats across pages');
select t.ok((select t.walk('latest', 'old') = (select array_agg(id order by created_at asc, id asc) from public.posts where community_id is null)),
  'Oldest first pages the other way, also complete');
select t.ok(not ('blockedpost' = any (t.walk('latest', 'new'))), 'a blocked person''s post stays out');
select t.ok((select jsonb_array_length(public.feed_page('latest', 'new', '', '', null, null, null, 12)->'items') = 12), 'a page holds the limit asked for');
select t.ok((select jsonb_array_length(public.feed_page('latest', 'new', '', '', null, null, null, 500)->'items') <= 30), 'a page is never more than 30');

-- ---------- Clubs, chapter, following: scoped and still matching RLS ----------
select t.ok((select coalesce(t.walk('clubs', 'new'), '{}') = coalesce((select array_agg(p.id order by p.created_at desc, p.id desc) from public.posts p
  where p.community_id in (select community_id from public.community_members where uid = auth.uid()) and p.status = 'visible'), '{}')), 'Clubs is your clubs'' visible posts');
select t.ok(not exists (select 1 from unnest(t.walk('clubs', 'new')) x join public.posts p on p.id = x where p.body in ('Held for review', 'Members-only post')), 'held and private-club posts stay out of Clubs');
select t.ok((select coalesce(t.walk('community', 'new', '', 'rkt'), '{}') = coalesce((select array_agg(id order by created_at desc, id desc) from public.posts where community_id = 'rkt' and status = 'visible'), '{}')), 'one club (your chapter) pages on its own');
select t.ok((select coalesce(t.walk('community', 'new', '', 'secretclub'), '{}') = '{}'), 'asking for a private club you''re not in returns nothing');
select t.ok((select bool_and(p.author_id in (select target from public.follows where follower = auth.uid())
  or exists (select 1 from public.connections c where c.status = 'accepted' and c.users @> array[auth.uid(), p.author_id]))
  from unnest(t.walk('following', 'new')) x join public.posts p on p.id = x) is not false, 'Following only has people you follow or are connected with');

-- ---------- For you: ranked, then past the window newest first; complete ----------
select t.ok((select (select array_agg(x order by x) from unnest(t.walk('for-you', 'best')) x)
  = (select array_agg(id order by id) from public.posts p where p.community_id is null or (p.community_id in (select community_id from public.community_members where uid = auth.uid()) and p.status = 'visible'))),
  'For you, all pages: every post you may see once (public plus your clubs), none twice');
select t.ok((select array_position(t.walk('for-you', 'best'), (select id from public.posts where body = 'Old post from last month'))
  > array_position(t.walk('for-you', 'best'), 'liked1')), 'a post past the 30-day window comes after the ranked ones');

-- ---------- Each card: flags, counts, replies, reason ----------
select t.ok((select (c->>'liked')::boolean and (c->>'saved')::boolean and (c->>'like_count')::int = 2 and (c->>'comment_count')::int = 3
  from jsonb_array_elements(public.feed_page('latest', 'new', '', '', null, null, null, 30)->'items') c where c->>'id' = 'liked1'), 'liked, saved and both counts are right');
select t.ok((select (select array_agg(r->>'body' order by o) from jsonb_array_elements(c->'replies') with ordinality e(r, o)) = array['Second reply', 'Third reply']
  from jsonb_array_elements(public.feed_page('latest', 'new', '', '', null, null, null, 30)->'items') c where c->>'id' = 'liked1'), 'the latest two replies, oldest of them first');
select t.ok((select bool_and(c->>'reason' <> '') from jsonb_array_elements(public.feed_page('for-you', 'new', '', '', null, null, null, 30)->'items') c where c->>'author_id' <> auth.uid()::text),
  'For you says why each post is there (except your own)');
select t.ok((select bool_and(c->>'reason' = '') from jsonb_array_elements(public.feed_page('latest', 'new', '', '', null, null, null, 30)->'items') c), 'Latest gives no reasons');

-- Josh can't see Ben's like or save as his own.
reset role; select t.as_('josh'); set local role authenticated;
select t.ok((select not (c->>'liked')::boolean and not (c->>'saved')::boolean
  from jsonb_array_elements(public.feed_page('latest', 'new', '', '', null, null, null, 30)->'items') c where c->>'id' = 'liked1'), 'liked and saved are your own, not someone else''s');

-- as_of holds the newest edge: a post made after the first page isn't in later pages.
select t.ok((select jsonb_array_length(public.feed_page('latest', 'new', '', '', null, null, now() - interval '1 day', 30)->'items') > 0
  and not exists (select 1 from jsonb_array_elements(public.feed_page('latest', 'new', '', '', null, null, now() - interval '1 day', 30)->'items') c where (c->>'created_at')::timestamptz > now() - interval '1 day')),
  'pages stop at the first page''s moment (newer posts come as the pill)');

-- Signed out: nothing.
reset role; select set_config('request.jwt.claim.sub', '', true);
select t.ok((select jsonb_array_length(public.feed_page()->'items') = 0), 'signed out gets an empty page');

-- ---------- Counters stay right ----------
reset role; select t.as_('ben'); set local role authenticated;
delete from public.likes where post_id = 'liked1';
reset role;
select t.ok((select like_count = (select count(*) from public.likes where post_id = 'liked1') from public.posts where id = 'liked1'), 'like_count follows an unlike');
select t.ok(not exists (select 1 from public.posts p where p.like_count <> (select count(*) from public.likes l where l.post_id = p.id)
  or p.comment_count <> (select count(*) from public.comments c where c.post_id = p.id)), 'every post''s counters match its likes and replies');

-- ---------- Security and the placeholder ----------
select t.ok((select not prosecdef from pg_proc where proname = 'feed_page'), 'feed_page runs as the caller (security invoker), so RLS applies');
select t.ok(not has_function_privilege('anon', 'public.feed_page(text, text, text, text, text, jsonb, timestamptz, int)', 'execute'), 'signed-out visitors can''t call it');
select t.ok(public.post_media_ok(jsonb_build_array(jsonb_build_object('type', 'image', 'path', :'ben' || '/0b1c2d3e-4f50-4617-8899-aabbccddeeff.webp', 'lq', 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=')), :'ben'), 'a WebP data: placeholder is accepted');
select t.ok(not public.post_media_ok(jsonb_build_array(jsonb_build_object('type', 'image', 'path', :'ben' || '/0b1c2d3e-4f50-4617-8899-aabbccddeeff.webp', 'lq', 'https://evil.example/x.webp')), :'ben'), 'a placeholder can''t be a link');
select t.ok(not public.post_media_ok(jsonb_build_array(jsonb_build_object('type', 'image', 'path', :'ben' || '/0b1c2d3e-4f50-4617-8899-aabbccddeeff.webp', 'lq', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')), :'ben'), 'a placeholder can''t be SVG');
select t.ok(not public.post_media_ok(jsonb_build_array(jsonb_build_object('type', 'image', 'path', :'ben' || '/0b1c2d3e-4f50-4617-8899-aabbccddeeff.webp', 'lq', 'data:image/webp;base64,' || repeat('A', 2000))), :'ben'), 'a placeholder stays tiny');
select t.ok(public.post_media_ok(jsonb_build_array(jsonb_build_object('type', 'video', 'path', :'ben' || '/0b1c2d3e-4f50-4617-8899-aabbccddeeff.mp4', 'bytes', 7340032, 'poster', :'ben' || '/1b1c2d3e-4f50-4617-8899-aabbccddeeff.webp')), :'ben'), 'step 43''s keys still pass');

select t.ok(public.feed_pages_ready(), 'the app can tell the step has run');

rollback;
\echo 'feed-pages tests: all passed'
