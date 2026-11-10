-- Remove test content from production (clubs, events and posts made while testing).
-- NOT part of the migration order. Run by hand in the Supabase SQL Editor, in two steps:
--
--   1. Run the PREVIEW block alone and read every row it lists.
--   2. If, and only if, every row is test data, run the DELETE block. It runs in a transaction
--      and prints how many rows it removed; anything unexpected, run ROLLBACK instead of COMMIT.
--
-- Matching is by exact name first (the known test items), then by obvious test patterns.
-- Deleting a club also deletes its posts, members, events and chat (foreign keys cascade).

-- ---------- 1. PREVIEW ----------
with names(n) as (values ('Dummy Group'), ('TEST EVENT'), ('test'), ('TEST TESTllll'), ('HELLO FREE WORLD'))
select 'club' as kind, c.id, c.name as label, c.member_count::text as detail, c.created_at
  from public.communities c
 where c.name in (select n from names) or c.name ~* '^(test|dummy)\b' or c.name ~* '\btest(ing)?\s*(club|group)\b'
union all
select 'event', e.id, e.title, coalesce((select name from public.communities where id = e.community_id), 'org event'), e.created_at
  from public.events e
 where e.title in (select n from names) or e.title ~* '^(test|dummy)\b'
union all
select 'post', p.id, left(p.body, 80), p.author_first || ' ' || p.author_last, p.created_at
  from public.posts p
 where p.body in (select n from names) or p.body ~* '^\s*(test|testing|hello free world|dummy)\W*$'
order by kind, created_at;

-- ---------- 2. DELETE (only after reading the preview) ----------
-- begin;
-- with names(n) as (values ('Dummy Group'), ('TEST EVENT'), ('test'), ('TEST TESTllll'), ('HELLO FREE WORLD')),
--   p as (delete from public.posts where body in (select n from names) or body ~* '^\s*(test|testing|hello free world|dummy)\W*$' returning 1),
--   e as (delete from public.events where title in (select n from names) or title ~* '^(test|dummy)\b' returning 1),
--   c as (delete from public.communities where name in (select n from names) or name ~* '^(test|dummy)\b' or name ~* '\btest(ing)?\s*(club|group)\b' returning 1)
-- select (select count(*) from p) as posts_removed, (select count(*) from e) as events_removed, (select count(*) from c) as clubs_removed;
-- commit;   -- or: rollback;
