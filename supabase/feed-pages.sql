-- Step 45: the feed in pages (Linear FIX-77). One call returns a page of about 12 complete post cards:
-- the post, its author's photo, whether you liked or saved it, its latest two replies, why it's in your
-- feed, and the project box. Pages continue from a cursor (keyset), never OFFSET, so page 40 costs what
-- page 1 does. Run after pro-storage.sql. Additive and safe to re-run.
--
-- Security: feed_page() is SECURITY INVOKER, so every table it reads (posts, comments, likes, saved,
-- projects, project_details, milestones, profiles) applies the caller's row-level security exactly as
-- the app's direct queries did. It adds no access; it only saves round trips.
--
-- Counts come from posts.like_count and posts.comment_count, kept by the triggers in schema.sql.

-- ---------- Keyset indexes: (created_at desc, id desc), matching the page order ----------
create index if not exists posts_public_keyset_idx on public.posts (created_at desc, id desc) where community_id is null;
create index if not exists posts_club_keyset_idx on public.posts (community_id, created_at desc, id desc) where status = 'visible';
-- The latest replies per post (schema.sql's comments_post_idx is (post_id, created_at) ascending; a
-- backward scan serves "latest two" too, so no new index is needed there).

-- ---------- Post media may carry a tiny blurred placeholder (lq) ----------
-- A ~16 px WebP (PNG on Safari) as a data: URI, made in the browser at upload, so a card has its shape and colour
-- before the image arrives. Every other rule is step 43's, unchanged.
create or replace function public.post_media_ok(m jsonb, owner uuid) returns boolean
language plpgsql immutable as $$
declare
  e jsonb;
  n jsonb;
  images int := 0;
  videos int := 0;
  cmps int := 0;
begin
  if m is null or jsonb_typeof(m) <> 'array' or jsonb_array_length(m) > 4 then return false; end if;
  for e in select value from jsonb_array_elements(m) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(e) k where k not in ('type', 'path', 'w', 'h', 'alt', 'notes', 'marks', 'cmp', 'cc', 'tx', 'bytes', 'poster', 'lq')) then return false; end if;
    if coalesce(e->>'type', '') not in ('image', 'video') then return false; end if;
    if jsonb_typeof(e->'path') is distinct from 'string' or e->>'path' = '' or not public.media_path_ok(e->>'path', owner) then return false; end if;
    if (e ? 'w' and jsonb_typeof(e->'w') <> 'number') or (e ? 'h' and jsonb_typeof(e->'h') <> 'number') then return false; end if;
    if e ? 'alt' then
      if jsonb_typeof(e->'alt') <> 'string' or char_length(e->>'alt') > 200 then return false; end if;
    end if;
    if e ? 'notes' then
      if e->>'type' <> 'image' or jsonb_typeof(e->'notes') <> 'array' or jsonb_array_length(e->'notes') > 6 then return false; end if;
      for n in select value from jsonb_array_elements(e->'notes') loop
        if jsonb_typeof(n) <> 'object' then return false; end if;
        if jsonb_typeof(n->'x') is distinct from 'number' or jsonb_typeof(n->'y') is distinct from 'number' or jsonb_typeof(n->'t') is distinct from 'string' then return false; end if;
        if (n->>'x')::numeric not between 0 and 1 or (n->>'y')::numeric not between 0 and 1 or char_length(btrim(n->>'t')) not between 1 and 80 then return false; end if;
      end loop;
    end if;
    if e ? 'marks' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'marks') <> 'array' or jsonb_array_length(e->'marks') > 8 then return false; end if;
      for n in select value from jsonb_array_elements(e->'marks') loop
        if jsonb_typeof(n) <> 'object' then return false; end if;
        if jsonb_typeof(n->'s') is distinct from 'number' or jsonb_typeof(n->'t') is distinct from 'string' then return false; end if;
        if (n->>'s')::numeric not between 0 and 3600 or char_length(btrim(n->>'t')) not between 1 and 60 then return false; end if;
      end loop;
    end if;
    if e ? 'cc' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'cc') <> 'string' or char_length(e->>'cc') > 20000
         or left(e->>'cc', 6) <> 'WEBVTT' or position('-->' in (e->>'cc')) = 0 then return false; end if;
    end if;
    if e ? 'tx' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'tx') <> 'string' or char_length(btrim(e->>'tx')) not between 1 and 5000 then return false; end if;
    end if;
    if e ? 'bytes' then
      if jsonb_typeof(e->'bytes') <> 'number' or (e->>'bytes')::numeric <> floor((e->>'bytes')::numeric)
         or (e->>'bytes')::numeric not between 1 and 262144000 then return false; end if;
    end if;
    if e ? 'poster' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'poster') <> 'string' or not public.media_path_ok(e->>'poster', owner)
         or right(e->>'poster', 5) <> '.webp' then return false; end if;
    end if;
    -- The placeholder (step 45): a small WebP or PNG data: URI only (never SVG or a link), so it can't
    -- point anywhere or run anything.
    if e ? 'lq' then
      if jsonb_typeof(e->'lq') <> 'string' or char_length(e->>'lq') > 1500
         or (e->>'lq') !~ '^data:image/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
    end if;
    if e ? 'cmp' then
      if jsonb_typeof(e->'cmp') <> 'boolean' then return false; end if;
      if (e->'cmp')::boolean then cmps := cmps + 1; end if;
    end if;
    if e->>'type' = 'image' then images := images + 1; else videos := videos + 1; end if;
  end loop;
  if videos > 0 and jsonb_array_length(m) <> 1 then return false; end if;
  if cmps > 0 and not (cmps = 2 and images = 2 and jsonb_array_length(m) = 2) then return false; end if;
  return true;
end
$$;

-- ---------- One page of the feed ----------
-- p_tab:    latest | following | clubs | community (one club: your chapter) | for-you
-- p_sort:   new | old, or best (For you only: a bounded pool from the last 30 days, ranked like
--           lib/feed-rank.ts; then it carries on newest first, so the feed never ends while there are posts)
-- p_cursor: null for the first page, then the "next" this function returned
-- p_as_of:  the moment the first page was made; later pages pass it back so scores and the "newest"
--           edge stay put while you scroll (posts after it arrive as the "N new posts" pill instead)
create or replace function public.feed_page(
  p_tab text default 'latest', p_sort text default 'new', p_kind text default '', p_tag text default '',
  p_community text default null, p_cursor jsonb default null, p_as_of timestamptz default null, p_limit int default 12
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit, 12), 1), 30);
  asof timestamptz := coalesce(p_as_of, now());
  win timestamptz := coalesce(p_as_of, now()) - interval '30 days';
  ranked boolean := p_tab = 'for-you' and coalesce(p_sort, 'best') = 'best';
  asc_ boolean := coalesce(p_sort, '') = 'old';
  c_at timestamptz := (p_cursor->>'at')::timestamptz;
  c_s numeric := (p_cursor->>'s')::numeric;
  c_id text := p_cursor->>'id';
  clubs text[];
  people uuid[];
  likes_of text[];
  t_pub text; t_club text; t_people text; t_one text; t_topics text; src text; merge text; q text; bound text;
  filt text := '';
  score text;
  ids text[] := '{}';
  more text[];
  last_id text;
  last_at timestamptz;
  last_s numeric;
  next jsonb;
  pool text[] := '{}';
  edge_at timestamptz;
  edge_id text;
begin
  if me is null then return jsonb_build_object('items', '[]'::jsonb, 'next', null, 'as_of', asof); end if;
  select coalesce(array_agg(community_id), '{}') into clubs from public.community_members where uid = me;
  select coalesce(array_agg(distinct x), '{}') into people from (
    select target as x from public.follows where follower = me
    union select u from public.connections c, unnest(c.users) u where c.users @> array[me] and c.status = 'accepted' and u <> me
  ) s;
  select coalesce(interests, '{}') into likes_of from public.profiles where id = me;

  if p_kind = 'video' then filt := filt || ' and p.media @> ''[{"type": "video"}]''::jsonb';
  elsif coalesce(p_kind, '') <> '' then filt := filt || ' and p.kind = $6'; end if;
  if coalesce(p_tag, '') <> '' then filt := filt || ' and p.tags @> array[$7]'; end if;

  -- Where posts come from, each read newest first through its own index and stopped at {N} rows, then
  -- merged: public posts (posts_public_keyset_idx), each of your clubs and each person you follow (one
  -- index read apiece). {B} is the page's bound, {O} its order. Nothing scans the whole table.
  t_pub := '(select p.id, p.created_at from public.posts p where p.community_id is null' || filt || ' and {B} order by {O} limit {N})';
  t_club := '(select x.id, x.created_at from unnest($3::text[]) cc(cid) cross join lateral (select p.id, p.created_at from public.posts p where p.community_id = cc.cid and p.status = ''visible''' || filt || ' and {B} order by {O} limit {N}) x)';
  t_people := '(select x.id, x.created_at from unnest($4::uuid[]) pp(uid) cross join lateral (select p.id, p.created_at from public.posts p where p.author_id = pp.uid and p.community_id is null' || filt || ' and {B} order by {O} limit {N}) x)';
  t_one := '(select p.id, p.created_at from public.posts p where p.community_id = $5 and p.status = ''visible''' || filt || ' and {B} order by {O} limit {N})';
  t_topics := '(select p.id, p.created_at from public.posts p where p.community_id is null and p.tags && $11' || filt || ' and {B} order by {O} limit {N})';
  src := case p_tab when 'latest' then t_pub when 'following' then t_people when 'clubs' then t_club when 'community' then t_one
    when 'for-you' then t_pub || ' union all ' || t_club else '(select null::text as id, null::timestamptz as created_at where false)' end;
  merge := 'select coalesce(array_agg(id order by {O2}), ''{}''), (array_agg(created_at order by {R2}))[1], (array_agg(id order by {R2}))[1]
    from (select id, created_at from ({S}) z order by {O2} limit {N}) y';

  -- Scores are numeric, rounded to 6 places, so the cursor's score compares exactly (a float8 loses digits
  -- on its way through JSON, and a post could repeat or be skipped at a page edge).
  -- lib/feed-rank.ts scorePost(), in hours: newer first, plus your clubs, people you follow, your
  -- topics, results, fresh unanswered questions and engagement. Your own post leads for 3 hours.
  score := $s$case when p.author_id = $10 and p.community_id is null and p.created_at > $1 - interval '3 hours'
      then 1e6 - extract(epoch from ($1 - p.created_at)) / 3600
    else - greatest(0, extract(epoch from ($1 - p.created_at)) / 3600)
      + 36 * (select count(*) from unnest(p.tags) t where t = any($11))
      + case when p.community_id = any($3) then 48 else 0 end
      + case when p.community_id is null and p.author_id = any($4) then 30 else 0 end
      + case when p.kind = 'result' then 18 else 0 end
      + case when p.kind = 'question' and p.comment_count = 0 and p.created_at > $1 - interval '72 hours' then 16 else 0 end
      + log(2, 1 + p.like_count + 2 * p.comment_count) * 6 end$s$;

  if ranked then
    -- The pool For you ranks (bounded, like the old lib/feed-rank.ts sources): the newest 200 posts you
    -- may see from the last 30 days, plus the newest 60 from your clubs, 60 from people you follow and
    -- 80 on your topics.
    q := replace(replace(replace(replace(replace(replace(merge, '{S}', src), '{B}', 'p.created_at <= $1 and p.created_at > $2'),
      '{O}', 'p.created_at desc, p.id desc'), '{O2}', 'created_at desc, id desc'), '{R2}', 'created_at asc, id asc'), '{N}', '200');
    execute q into pool, edge_at, edge_id using asof, win, clubs, people, p_community, p_kind, p_tag, lim, c_id, me, likes_of, c_s, pool;
    if cardinality(pool) < 200 then edge_at := win; edge_id := null; end if;  -- the whole window fits
    foreach q in array array[replace(t_club, '{N}', '60'), replace(t_people, '{N}', '60'), replace(t_topics, '{N}', '80')] loop
      execute 'select coalesce(array_agg(id), ''{}'') from ' || replace(replace(q, '{B}', 'p.created_at <= $1 and p.created_at > $2'), '{O}', 'p.created_at desc, p.id desc') || ' z'
        into more using asof, win, clubs, people, p_community, p_kind, p_tag, lim, c_id, me, likes_of, c_s, pool;
      pool := pool || array(select x from unnest(more) x where not (x = any(pool)));
    end loop;

    if c_at is null then
      -- Ranked: the pool, best first, continuing after the cursor's (score, id).
      execute format('select coalesce(array_agg(id order by s desc, id desc), ''{}''), (array_agg(s order by s asc, id asc))[1]
        from (select id, s from (select p.id, round((%s)::numeric, 6) as s from public.posts p where p.id = any($13)) x
              where $12::numeric is null or (s, id) < ($12, $9)
              order by s desc, id desc limit $8) y', score)
        into ids, last_s using asof, win, clubs, people, p_community, p_kind, p_tag, lim, c_id, me, likes_of, c_s, pool;
      if cardinality(ids) = lim then
        next := jsonb_build_object('s', last_s, 'id', ids[lim]);
      else
        -- The pool is done: carry on newest first from its edge, skipping what it already showed.
        c_at := edge_at; c_id := edge_id;
      end if;
    end if;
  end if;

  if next is null and (not ranked or c_at is not null) then
    -- Newest (or oldest) first after the cursor. The bound is written out per case so the index can
    -- start right at the cursor (an OR here would make it read from the top every page).
    bound := 'p.created_at <= $1' || case
      when c_at is null then ''
      when asc_ then ' and (p.created_at, p.id) > ($2, coalesce($9, ''''))'
      when c_id is null then ' and p.created_at <= $2'
      else ' and (p.created_at, p.id) < ($2, $9)' end
      || case when cardinality(pool) > 0 then ' and not (p.id = any($13))' else '' end;
    q := replace(replace(replace(replace(replace(replace(merge, '{S}', src), '{B}', bound),
      '{O}', case when asc_ then 'p.created_at asc, p.id asc' else 'p.created_at desc, p.id desc' end),
      '{O2}', case when asc_ then 'created_at asc, id asc' else 'created_at desc, id desc' end),
      '{R2}', case when asc_ then 'created_at desc, id desc' else 'created_at asc, id asc' end), '{N}', '$8');
    execute q into more, last_at, last_id using asof, c_at, clubs, people, p_community, p_kind, p_tag, lim - cardinality(ids), c_id, me, likes_of, c_s, pool;
    ids := ids || more;
    if cardinality(more) > 0 and cardinality(ids) = lim then
      next := jsonb_build_object('at', last_at, 'id', last_id);
    end if;
  end if;

  return jsonb_build_object('as_of', asof, 'next', next, 'items', coalesce((
    select jsonb_agg(card order by ord) from (
      select u.ord, jsonb_build_object(
        'id', p.id, 'author_id', p.author_id, 'author_first', p.author_first, 'author_last', p.author_last,
        'author_headline', p.author_headline, 'body', p.body, 'kind', p.kind, 'tags', p.tags,
        'like_count', p.like_count, 'comment_count', p.comment_count, 'created_at', p.created_at, 'edited_at', p.edited_at,
        'project_id', p.project_id, 'community_id', p.community_id, 'community_name', p.community_name,
        'media', p.media, 'mentions', p.mentions,
        'author', jsonb_build_object('avatar_path', a.avatar_path),
        'liked', exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = me),
        'saved', exists (select 1 from public.saved v where v.user_id = me and v.post_id = p.id),
        'replies', coalesce((select jsonb_agg(r order by r.created_at, r.id) from (
            select c.id, c.author_id, c.author_first, c.author_last, c.body, c.created_at from public.comments c
            where c.post_id = p.id order by c.created_at desc, c.id desc limit 2) r), '[]'::jsonb),
        'reason', case
          when p.author_id = me then ''
          when p_tab = 'clubs' then coalesce('In ' || p.community_name, '')
          when p_tab <> 'for-you' then ''
          when p.community_id = any(clubs) and p.community_name is not null then 'From your club ' || p.community_name
          when p.community_id is null and p.author_id = any(people) then coalesce('Because you follow ' || nullif(btrim(p.author_first || ' ' || p.author_last), ''), 'From someone you follow')
          when p.tags && likes_of then 'Matches your interest: ' || (select t from unnest(p.tags) t where t = any(likes_of) limit 1)
          when p.kind = 'question' and p.comment_count = 0 then 'Unanswered question'
          when p.like_count + p.comment_count >= 5 then 'Popular on Brazework'
          else 'New on Brazework' end,
        'project', case when p.project_id is null then null else (
          select jsonb_build_object('id', pr.id, 'title', pr.title, 'status', pr.status, 'year', pr.year, 'private', pr.private,
            'updated_at', pr.updated_at, 'tools', to_jsonb(pr.tools[1:4]),
            'specs', coalesce((select jsonb_agg(sp) from (select sp from public.project_details d, jsonb_array_elements(d.specs) sp
                where d.project_id = pr.id and coalesce(sp->>'label', '') <> '' and coalesce(sp->>'value', '') <> '' limit 3) z), '[]'::jsonb),
            'verified', (select jsonb_build_object('n', count(*), 'clubs', coalesce(jsonb_agg(distinct m.community_name) filter (where coalesce(m.community_name, '') <> ''), '[]'::jsonb))
                from public.milestones m where m.project_id = pr.id and m.status = 'verified'))
          from public.projects pr where pr.id = p.project_id) end
      ) as card
      from unnest(ids) with ordinality u(id, ord)
      join public.posts p on p.id = u.id
      left join public.profiles a on a.id = p.author_id
    ) cards), '[]'::jsonb));
end
$$;
revoke execute on function public.feed_page(text, text, text, text, text, jsonb, timestamptz, int) from anon, public;
grant execute on function public.feed_page(text, text, text, text, text, jsonb, timestamptz, int) to authenticated;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.feed_pages_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.feed_pages_ready() to authenticated;
