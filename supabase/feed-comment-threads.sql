-- Step 54: the feed's comment previews carry what step 53 added, so comments can be liked, replied
-- to, edited and deleted right on a feed card: each preview now has parent_id, edited_at, like_count
-- and whether you liked it. feed_page() is otherwise exactly step 46's (supabase/mcp-writes.sql).
-- Safe to re-run. Run after comment-threads.sql.

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
        'media', p.media, 'mentions', p.mentions, 'via', p.via,
        'author', jsonb_build_object('avatar_path', a.avatar_path),
        'liked', exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = me),
        'saved', exists (select 1 from public.saved v where v.user_id = me and v.post_id = p.id),
        'replies', coalesce((select jsonb_agg(r order by r.created_at, r.id) from (
            select c.id, c.author_id, c.author_first, c.author_last, c.body, c.created_at,
                   c.parent_id, c.edited_at, c.like_count,
                   exists (select 1 from public.comment_likes cl where cl.comment_id = c.id and cl.user_id = me) as liked
              from public.comments c
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

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.feed_comment_threads_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.feed_comment_threads_ready() to authenticated;
