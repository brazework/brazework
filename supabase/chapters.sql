-- Step 41: chapters (Linear FIX-71). A national network (NSBE National) has chapters at schools:
-- "NSBE - University of Hartford" is a club (community) that belongs to a school and to a network.
-- Chapters keep everything clubs already have (invites, roles, the verify queue, the weekly report);
-- this adds the links between them and the numbers that let chapters see each other.
-- Additive and safe to re-run. Run after project-files-access.sql.

-- ---------- National networks ----------
-- A network is an organization of type 'network'. Forge admins add them (nobody signs one up), so a
-- chapter can only claim a network that's really on the list.
alter table public.organizations drop constraint if exists organizations_type_check;
alter table public.organizations add constraint organizations_type_check check (type in ('company', 'school', 'forge', 'network'));
alter table public.organizations add column if not exists short_name text check (short_name is null or char_length(short_name) between 2 and 24);
alter table public.organizations add column if not exists slug text check (slug is null or slug ~ '^[a-z0-9-]{2,40}$');
alter table public.organizations add column if not exists about text not null default '' check (char_length(about) <= 600);
create unique index if not exists organizations_slug_key on public.organizations (slug) where slug is not null;

-- ---------- Chapters ----------
-- network_id and school_domain have no update grant (club admins edit other columns by grant), so the
-- only way to become a chapter is create_chapter() below.
alter table public.communities add column if not exists network_id text references public.organizations (id) on delete set null;
alter table public.communities add column if not exists school_domain text references public.school_domains (domain) on delete set null;
create unique index if not exists communities_one_chapter_per_school on public.communities (network_id, school_domain) where network_id is not null and school_domain is not null;
create index if not exists communities_network_idx on public.communities (network_id) where network_id is not null;

-- The school for a domain, matching subdomains (cs.hartford.edu → hartford.edu).
create or replace function public.school_for_host(p_host text) returns public.school_domains
language sql stable security definer set search_path = public as $$
  select d.* from public.school_domains d
   where lower(p_host) = d.domain or right(lower(p_host), char_length(d.domain) + 1) = '.' || d.domain
   order by char_length(d.domain) desc limit 1
$$;
revoke execute on function public.school_for_host(text) from anon, authenticated, public;

-- Your school, from your confirmed email: { domain, school } or null.
create or replace function public.my_school() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('domain', s.domain, 'school', s.school)
    from auth.users u, lateral public.school_for_host(split_part(u.email, '@', 2)) s
   where u.id = auth.uid() and u.email_confirmed_at is not null and s.domain is not null
$$;
grant execute on function public.my_school() to authenticated;

-- National networks a chapter can join, for the "Start a chapter" picker.
create or replace function public.list_networks() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'short', coalesce(short_name, name), 'slug', slug) order by name), '[]'::jsonb)
    from public.organizations where type = 'network' and verification_status = 'verified'
$$;
grant execute on function public.list_networks() to anon, authenticated;

-- Starts a chapter: you become its owner. Your confirmed email has to be at the school, there's one
-- chapter per school per network, and the name is made for you ("NSBE - University of Hartford").
create or replace function public.create_chapter(p_network text, p_privacy text default 'approval') returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_email text; v_school public.school_domains; v_net public.organizations; v_name text; v_existing text; cid text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select lower(email) into v_email from auth.users where id = me.id and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your email first.' using errcode = '42501'; end if;
  v_school := public.school_for_host(split_part(v_email, '@', 2));
  if v_school.domain is null then raise exception 'Start a chapter from your school email, so members know it''s really your school.' using errcode = 'P0001'; end if;
  select * into v_net from public.organizations where id = p_network and type = 'network' and verification_status = 'verified';
  if v_net.id is null then raise exception 'Pick a national organization from the list.' using errcode = 'P0001'; end if;
  if p_privacy not in ('public', 'approval') then raise exception 'Choose open or approval to join.' using errcode = 'P0001'; end if;
  select name into v_existing from public.communities where network_id = v_net.id and school_domain = v_school.domain;
  if v_existing is not null then raise exception '% is already on Brazework. Ask its lead for the invite link.', v_existing using errcode = 'P0001'; end if;
  v_name := left(coalesce(v_net.short_name, v_net.name) || ' - ' || v_school.school, 60);
  if exists (select 1 from public.communities where name_lower = lower(v_name)) then
    raise exception 'A club named % already exists. Ask its owner, or contact Brazework to link it as the chapter.', v_name using errcode = 'P0001';
  end if;
  insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name, network_id, school_domain)
  values (v_name, 'The ' || coalesce(v_net.short_name, v_net.name) || ' chapter at ' || v_school.school || '. We build, post what we build every week, and verify each other''s milestones.',
          '', 'school', p_privacy, '{}', '', me.id, trim(me.first_name || ' ' || me.last_name), v_net.id, v_school.domain)
  returning id into cid;
  insert into public.community_members (community_id, uid, role) values (cid, me.id, 'owner');
  return cid;
end $$;
revoke execute on function public.create_chapter(text, text) from anon, public;
grant execute on function public.create_chapter(text, text) to authenticated;

-- ---------- The network page ----------
-- Everything a national page shows, readable signed out: the network, and each chapter's numbers for
-- the last p_days (members, how many of them were active, posts, verified milestones), most active
-- first. Totals only; no posts or names. Recent verified work is public milestones only.
create or replace function public.network_page(p_slug text, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_net public.organizations; v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365)); v_out jsonb;
begin
  select * into v_net from public.organizations where slug = lower(p_slug) and type = 'network' and verification_status = 'verified';
  if v_net.id is null then return null; end if;
  with ch as (
    select c.id, c.name, c.member_count, s.school
      from public.communities c left join public.school_domains s on s.domain = c.school_domain
     where c.network_id = v_net.id
  ), posts as (
    select p.community_id, count(*) as n, array_agg(distinct p.author_id) as who
      from public.posts p join ch on ch.id = p.community_id
     where p.status = 'visible' and p.created_at > v_since group by p.community_id
  ), ver as (
    select m.community_id, count(*) as n, array_agg(distinct m.owner_id) as who
      from public.milestones m join ch on ch.id = m.community_id
     where m.status = 'verified' and m.reviewed_at > v_since group by m.community_id
  ), rows as (
    select ch.id, ch.name, ch.school, ch.member_count,
           coalesce(posts.n, 0) as posts, coalesce(ver.n, 0) as verified,
           (select count(distinct x) from unnest(coalesce(posts.who, '{}') || coalesce(ver.who, '{}')) x) as active
      from ch left join posts on posts.community_id = ch.id left join ver on ver.community_id = ch.id
  )
  select jsonb_build_object(
    'id', v_net.id, 'name', v_net.name, 'short', coalesce(v_net.short_name, v_net.name), 'slug', v_net.slug, 'about', v_net.about, 'days', extract(day from now() - v_since)::int,
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'school', school, 'members', member_count, 'active', active, 'posts', posts, 'verified', verified)
                                           order by active desc, verified desc, posts desc, member_count desc, name) from rows), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(r order by r->>'at' desc) from (
        select jsonb_build_object('title', m.title, 'by', trim(pr.first_name || ' ' || pr.last_name), 'owner', m.owner_id, 'chapter', m.community_name, 'chapter_id', m.community_id, 'at', m.reviewed_at) as r
          from public.milestones m join public.profiles pr on pr.id = m.owner_id
         where m.community_id in (select id from public.communities where network_id = v_net.id)
           and m.status = 'verified' and m.private = false
         order by m.reviewed_at desc limit 6) x), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
grant execute on function public.network_page(text, integer) to anon, authenticated;

-- ---------- The lead's week ----------
-- For a club's officers (moderator and up): every member with when they last posted anywhere, the
-- weeks (Monday starts) they were active in the last p_weeks, and how many of their milestones wait
-- for this club's verification. The app turns weeks into streaks (lib/streak.ts) and finds who's quiet.
create or replace function public.club_member_activity(p_cid text, p_weeks integer default 9) returns table (
  uid uuid, first_name text, last_name text, role text, joined_at timestamptz, last_active timestamptz, weeks date[], pending integer
) language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := date_trunc('week', now()) - make_interval(weeks => least(greatest(coalesce(p_weeks, 9), 1), 26) - 1);
begin
  if public.my_rank(p_cid) < 3 then raise exception 'Only officers see the weekly roster.' using errcode = '42501'; end if;
  return query
  with act as (
    select p.author_id as who, p.created_at as at from public.posts p
     where p.author_id in (select m.uid from public.community_members m where m.community_id = p_cid) and p.status = 'visible' and p.created_at > v_since
    union all
    select ms.owner_id, ms.created_at from public.milestones ms
     where ms.owner_id in (select m.uid from public.community_members m where m.community_id = p_cid) and ms.created_at > v_since
  ), last_post as (
    select p.author_id as who, max(p.created_at) as at from public.posts p
     where p.author_id in (select m.uid from public.community_members m where m.community_id = p_cid) and p.status = 'visible'
     group by p.author_id
  )
  select m.uid, pr.first_name, pr.last_name, m.role, m.joined_at, lp.at,
         coalesce((select array_agg(distinct date_trunc('week', a.at)::date order by date_trunc('week', a.at)::date) from act a where a.who = m.uid), '{}'),
         (select count(*)::int from public.milestones x where x.owner_id = m.uid and x.community_id = p_cid and x.status = 'pending')
    from public.community_members m
    join public.profiles pr on pr.id = m.uid
    left join last_post lp on lp.who = m.uid
   where m.community_id = p_cid
   order by lp.at desc nulls last;
end $$;
revoke execute on function public.club_member_activity(text, integer) from anon, public;
grant execute on function public.club_member_activity(text, integer) to authenticated;

-- NSBE National, so chapters have a network to start under. The page says chapters run it; NSBE can
-- claim it. (domain stays null: nobody can register it as a company.)
insert into public.organizations (type, name, short_name, slug, about)
select 'network', 'NSBE National', 'NSBE', 'nsbe', 'Chapters of the National Society of Black Engineers building on Brazework. Each chapter is run by its own members; this page shows their work together.'
 where not exists (select 1 from public.organizations where slug = 'nsbe');

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.chapters_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.chapters_ready() to authenticated, anon;
