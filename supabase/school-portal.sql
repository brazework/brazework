-- The school portal (the school-first realignment, 2026-11-26, docs/strategy.md build steps 2 to 5).
-- Run after club-projects.sql. Additive and safe to re-run.
--
-- A class is a community of type 'class' (like a study group, study-groups.sql): a course code, a term,
-- the school's email domain, private to its members. That reuses what clubs already have and is tested:
-- members and roles, class projects (projects.community_id), milestones and their verification
-- (review_milestone: rank 3+, never on the project's team), events and chat.
--
-- 1. School placement: your confirmed email's domain places you at your school (my_school(),
--    chapters.sql). Unregistered university domains are grouped too, from day one (school_domains gets
--    the domain when the first student with it confirms; the name is filled in when the school joins).
-- 2. Faculty: each school's own list (school_faculty), kept by the school's official admins
--    (speaks_for_school) or Brazework admins. Only someone on it, signed in with that confirmed email,
--    can start a class. Anyone with a school email is not faculty.
-- 3. Classes and rosters: faculty start a class (create_class) and set its roster by email
--    (set_class_roster: a CSV's emails). A student on a roster joins the class when their confirmed email
--    matches, now or when they sign up (sync_my_classes, and the roster write itself).
--    Students start class projects themselves (the project insert policy below), or faculty add them.
-- 4. The school's view: school_overview() and school_evidence() for the school's admins: students on
--    Brazework, classes this term, verified work by class, active clubs, and every verified milestone
--    with its student, class or club, verifier and evidence (the accreditation export).
--
-- Privacy (FERPA): classes are private ('approval': nobody joins without the roster or faculty), class
-- projects start private, and nothing here stores grades.

-- ---------- Classes are communities ----------
alter table public.communities drop constraint if exists communities_type_check;
alter table public.communities add constraint communities_type_check check (type in ('field', 'study', 'project', 'school', 'class'));
create index if not exists communities_class_idx on public.communities (school_domain, term) where type = 'class';
-- Club names are unique across Brazework; class names aren't (every school has an "ME 410 · Capstone
-- Design", and a course can have sections). The same professor can't start the same class twice in a
-- term (create_class says so).
do $$ begin
  if exists (select 1 from pg_indexes where indexname = 'communities_name_lower_idx' and indexdef not like '%WHERE%') then
    drop index public.communities_name_lower_idx;
  end if;
end $$;
create unique index if not exists communities_name_lower_idx on public.communities (name_lower) where type <> 'class';

-- Nobody turns a club into a class or a class into a club (type is otherwise editable by owners).
create or replace function public.communities_class_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.type = 'class') is distinct from (new.type = 'class') then
    raise exception 'A class stays a class, and a club stays a club.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists communities_class_guard on public.communities;
create trigger communities_class_guard before update of type on public.communities
  for each row execute function public.communities_class_guard();

-- create_community (schema.sql) makes clubs; classes come only from create_class below.
create or replace function public.create_community(p_name text, p_about text, p_field text, p_type text,
                                                   p_privacy text, p_topics text[], p_rules text)
returns text language plpgsql security definer set search_path = public as $$
declare cid text; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_type = 'class' then raise exception 'Classes are started by faculty, from Your school.' using errcode = '42501'; end if;
  insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name)
  values (p_name, coalesce(p_about, ''), coalesce(p_field, ''), p_type, p_privacy, coalesce(p_topics, '{}'),
          coalesce(p_rules, ''), me.id, trim(me.first_name || ' ' || me.last_name))
  returning id into cid;
  insert into public.community_members (community_id, uid, role) values (cid, me.id, 'owner');
  return cid;
end $$;

-- ---------- Your confirmed email ----------
create or replace function public.my_confirmed_email() returns text
language sql stable security definer set search_path = public as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null
$$;
revoke execute on function public.my_confirmed_email() from anon, public;
grant execute on function public.my_confirmed_email() to authenticated;

-- Speaks for the school: its official admins, or Brazework admins until it has some.
create or replace function public.runs_school(p_domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.speaks_for_school(p_domain) or public.is_forge_admin()
$$;
revoke execute on function public.runs_school(text) from anon, public;
grant execute on function public.runs_school(text) to authenticated;

-- ---------- 1. Placement: every university domain is grouped from day one ----------
-- When a student confirms a university email whose domain isn't listed yet, the domain is listed with
-- no name, so its students are already together when the school joins (my_school() then finds it).
create or replace function public.school_domain_from_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null and old.email is not distinct from new.email then return new; end if;
  end if;
  if d ~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$' and (public.school_for_host(d)).domain is null then
    insert into public.school_domains (domain, school) values (d, '') on conflict (domain) do nothing;
  end if;
  return new;
exception when others then return new;  -- never block a sign-in over this
end $$;
drop trigger if exists school_domain_from_signup on auth.users;
create trigger school_domain_from_signup after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.school_domain_from_signup();

-- ---------- 2. Faculty ----------
create table if not exists public.school_faculty (
  domain text not null,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+$' and char_length(email) <= 254),
  name text not null default '' check (char_length(name) <= 80 and name !~ '[<>]'),
  title text not null default '' check (char_length(title) <= 80 and title !~ '[<>]'),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (domain, email)
);
alter table public.school_faculty enable row level security;
revoke all on public.school_faculty from anon, authenticated;
grant select on public.school_faculty to authenticated;
drop policy if exists "the school reads its faculty" on public.school_faculty;
create policy "the school reads its faculty" on public.school_faculty for select to authenticated
  using (public.runs_school(domain) or email = public.my_confirmed_email());
drop policy if exists "members only" on public.school_faculty;
create policy "members only" on public.school_faculty as restrictive for select to authenticated using ((select public.is_member()));

-- Are you faculty at this school? (Signed in with a confirmed email on its list.)
create or replace function public.is_faculty(p_domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_faculty where domain = lower(p_domain) and email = public.my_confirmed_email())
$$;
revoke execute on function public.is_faculty(text) from anon, public;
grant execute on function public.is_faculty(text) to authenticated;

-- Adds faculty from a list: [{email, name, title}]. Emails must be at the school. Returns how many.
create or replace function public.add_faculty(p_domain text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare d text := lower(p_domain); r jsonb; e text; n int := 0;
begin
  if not public.runs_school(d) then raise exception 'Only your school''s admins can add faculty.' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'Send up to 2,000 faculty at a time.' using errcode = 'P0001'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    e := lower(btrim(r->>'email'));
    continue when e is null or e !~ '^[^@\s]+@[^@\s]+$';
    continue when not (split_part(e, '@', 2) = d or right(split_part(e, '@', 2), char_length(d) + 1) = '.' || d);
    insert into public.school_faculty (domain, email, name, title, added_by)
    values (d, e, left(btrim(coalesce(r->>'name', '')), 80), left(btrim(coalesce(r->>'title', '')), 80), auth.uid())
    on conflict (domain, email) do update set name = excluded.name, title = excluded.title;
    n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.remove_faculty(p_domain text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.runs_school(p_domain) then raise exception 'Only your school''s admins can remove faculty.' using errcode = '42501'; end if;
  delete from public.school_faculty where domain = lower(p_domain) and email = lower(btrim(p_email));
end $$;
revoke execute on function public.add_faculty(text, jsonb), public.remove_faculty(text, text) from anon, public;
grant execute on function public.add_faculty(text, jsonb), public.remove_faculty(text, text) to authenticated;

-- ---------- 3. Classes and rosters ----------
create table if not exists public.class_roster (
  community_id text not null references public.communities (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+$' and char_length(email) <= 254),
  added_at timestamptz not null default now(),
  primary key (community_id, email)
);
create index if not exists class_roster_email_idx on public.class_roster (email);
alter table public.class_roster enable row level security;
revoke all on public.class_roster from anon, authenticated;
grant select on public.class_roster to authenticated;
drop policy if exists "faculty read their roster" on public.class_roster;
create policy "faculty read their roster" on public.class_roster for select to authenticated
  using (public.my_rank(community_id) >= 3 or email = public.my_confirmed_email());
drop policy if exists "members only" on public.class_roster;
create policy "members only" on public.class_roster as restrictive for select to authenticated using ((select public.is_member()));

-- Faculty start a class at their school: "ME 410", "Capstone Design", "Fall 2026". You own it.
create or replace function public.create_class(p_course text, p_title text, p_term text, p_about text default '') returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles; s jsonb; d text; cid text; v_course text := upper(btrim(coalesce(p_course, ''))); v_title text := btrim(coalesce(p_title, '')); v_term text := btrim(coalesce(p_term, ''));
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  s := public.my_school(); d := s->>'domain';
  if d is null then raise exception 'Sign in with your school email to start a class.' using errcode = 'P0001'; end if;
  if not public.is_faculty(d) then raise exception 'Only faculty on your school''s list can start a class. Ask your school''s Brazework admin to add you.' using errcode = '42501'; end if;
  if v_course !~ '^[A-Z]{2,6}[ -]?[0-9]{2,4}[A-Z]?$' then raise exception 'Give the course code, like ME 410.' using errcode = 'P0001'; end if;
  if char_length(v_title) not between 2 and 44 then raise exception 'Give the class a name, up to 44 characters.' using errcode = 'P0001'; end if;
  if v_term !~ '^(Fall|Spring|Summer|Winter) 20[0-9]{2}$' then raise exception 'Give the term, like Fall 2026.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.communities c where c.type = 'class' and c.owner_id = me.id and c.school_domain = d and c.term = v_term and c.name_lower = lower(left(v_course || ' · ' || v_title, 60))) then
    raise exception 'You already have this class this term.' using errcode = 'P0001';
  end if;
  insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name, school_domain, course, term)
  values (left(v_course || ' · ' || v_title, 60), left(coalesce(p_about, ''), 500), '', 'class', 'approval', '{}', '', me.id,
          trim(me.first_name || ' ' || me.last_name), d, v_course, v_term)
  returning id into cid;
  insert into public.community_members (community_id, uid, role) values (cid, me.id, 'owner');
  return cid;
end $$;
revoke execute on function public.create_class(text, text, text, text) from anon, public;
grant execute on function public.create_class(text, text, text, text) to authenticated;

-- Sets the roster from a list of emails (a CSV's first column): adds new ones, keeps the rest unless
-- p_replace. Students already signed up with a matching confirmed email join at once. Returns the count.
create or replace function public.set_class_roster(p_cid text, p_emails text[], p_replace boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare c public.communities; e text; n int := 0;
begin
  select * into c from public.communities where id = p_cid;
  if c.id is null or c.type <> 'class' then raise exception 'That class no longer exists.' using errcode = 'P0001'; end if;
  if public.my_rank(p_cid) < 4 then raise exception 'Only the class''s faculty can change its roster.' using errcode = '42501'; end if;
  if cardinality(p_emails) > 1000 then raise exception 'A roster can have up to 1,000 students.' using errcode = 'P0001'; end if;
  if p_replace then
    delete from public.class_roster where community_id = p_cid and email <> all (select lower(btrim(x)) from unnest(p_emails) x);
  end if;
  foreach e in array p_emails loop
    e := lower(btrim(e));
    continue when e !~ '^[^@\s]+@[^@\s]+$' or char_length(e) > 254;
    insert into public.class_roster (community_id, email) values (p_cid, e) on conflict do nothing;
    n := n + 1;
  end loop;
  insert into public.community_members (community_id, uid, role)
  select p_cid, u.id, 'member' from public.class_roster r join auth.users u on lower(u.email) = r.email and u.email_confirmed_at is not null
   join public.profiles p on p.id = u.id
   where r.community_id = p_cid and not public.is_banned(p_cid, u.id)
  on conflict do nothing;
  return n;
end $$;
revoke execute on function public.set_class_roster(text, text[], boolean) from anon, public;
grant execute on function public.set_class_roster(text, text[], boolean) to authenticated;

-- Joins you to every class whose roster has your confirmed email. Your school page calls it.
create or replace function public.sync_my_classes() returns integer
language plpgsql security definer set search_path = public as $$
declare e text := public.my_confirmed_email(); n int;
begin
  if e is null or not exists (select 1 from public.profiles where id = auth.uid()) then return 0; end if;
  with added as (
    insert into public.community_members (community_id, uid, role)
    select r.community_id, auth.uid(), 'member' from public.class_roster r
     where r.email = e and not public.is_banned(r.community_id, auth.uid())
    on conflict do nothing returning 1)
  select count(*) into n from added;
  return n;
end $$;
revoke execute on function public.sync_my_classes() from anon, public;
grant execute on function public.sync_my_classes() to authenticated;

-- Your classes, newest term first, with your role in each.
create or replace function public.my_classes() returns table (id text, name text, course text, term text, role text, member_count integer, projects integer, waiting integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.course, c.term, m.role, c.member_count,
         (select count(*)::int from public.projects p where p.community_id = c.id),
         (select count(*)::int from public.milestones ms where ms.community_id = c.id and ms.status = 'pending')
    from public.community_members m join public.communities c on c.id = m.community_id
   where m.uid = auth.uid() and c.type = 'class'
   order by split_part(c.term, ' ', 2) desc, case split_part(c.term, ' ', 1) when 'Fall' then 4 when 'Summer' then 3 when 'Spring' then 2 else 1 end desc, c.course
$$;
revoke execute on function public.my_classes() from anon, public;
grant execute on function public.my_classes() to authenticated;

-- Class projects: a student in the class starts one under it (a club project still needs the club's
-- owner or admins). Class projects start private: the team and the class's faculty see them.
drop policy if exists "add your projects" on public.projects;
create policy "add your projects" on public.projects for insert to authenticated
  with check (owner_id = auth.uid()
    and (community_id is null
         or exists (select 1 from public.community_members m join public.communities c on c.id = m.community_id
                     where m.community_id = projects.community_id and m.uid = auth.uid()
                       and (m.role in ('owner', 'admin') or c.type = 'class'))));

-- Faculty run every project in their class, as club owners and admins do in a club (club-projects.sql).
-- (runs_project_club already counts owner and admin roles of the project's community; nothing to add.)

-- ---------- 4. The school's view ----------
-- Counts for the school's admins: students on Brazework at the school, its classes this term, class
-- projects, milestones verified in classes and in its verified clubs, active clubs in the last 30 days.
create or replace function public.school_overview(p_domain text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d text := lower(p_domain); r jsonb;
begin
  if not public.runs_school(d) then raise exception 'Only your school''s admins see this.' using errcode = '42501'; end if;
  with clubs as (select community_id id from public.club_school_links where school_domain = d and status = 'verified'),
       classes as (select id, term from public.communities where type = 'class' and school_domain = d)
  select jsonb_build_object(
    'students', (select count(*) from auth.users u where u.email_confirmed_at is not null
                  and (split_part(lower(u.email), '@', 2) = d or right(split_part(lower(u.email), '@', 2), char_length(d) + 1) = '.' || d)),
    'faculty', (select count(*) from public.school_faculty where domain = d),
    'classes', (select count(*) from classes),
    'class_projects', (select count(*) from public.projects p where p.community_id in (select id from classes)),
    'verified_in_classes', (select count(*) from public.milestones m where m.status = 'verified' and m.community_id in (select id from classes)),
    'verified_in_clubs', (select count(*) from public.milestones m where m.status = 'verified' and m.community_id in (select id from clubs)),
    'clubs', (select count(*) from clubs),
    'active_clubs', (select count(distinct m.community_id) from public.milestones m where m.community_id in (select id from clubs) and m.created_at > now() - interval '30 days'),
    'by_class', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'term', c.term, 'members', c.member_count,
                   'projects', (select count(*) from public.projects p where p.community_id = c.id),
                   'verified', (select count(*) from public.milestones m where m.community_id = c.id and m.status = 'verified'))
                   order by c.term desc, c.name)
                 from public.communities c where c.type = 'class' and c.school_domain = d), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.school_overview(text) from anon, public;
grant execute on function public.school_overview(text) to authenticated;

-- The accreditation export: every verified milestone in the school's classes and verified clubs.
create or replace function public.school_evidence(p_domain text) returns table (
  student text, project text, milestone text, detail text, setting text, term text, verified_by text, verifier_role text, verified_on date, evidence text, milestone_id text)
language plpgsql stable security definer set search_path = public as $$
declare d text := lower(p_domain);
begin
  if not public.runs_school(d) then raise exception 'Only your school''s admins see this.' using errcode = '42501'; end if;
  return query
    select btrim(pr.first_name || ' ' || pr.last_name), p.title, m.title, m.detail,
           c.name, c.term, m.reviewer_name, m.reviewer_role, m.reviewed_at::date,
           coalesce(nullif(m.evidence, ''), case when jsonb_array_length(m.evidence_items) > 0 then jsonb_array_length(m.evidence_items) || ' attached' else '' end),
           m.id
      from public.milestones m join public.communities c on c.id = m.community_id
      join public.projects p on p.id = m.project_id join public.profiles pr on pr.id = m.owner_id
     where m.status = 'verified'
       and ((c.type = 'class' and c.school_domain = d)
            or c.id in (select community_id from public.club_school_links where school_domain = d and status = 'verified'))
     order by m.reviewed_at desc
     limit 5000;
end $$;
revoke execute on function public.school_evidence(text) from anon, public;
grant execute on function public.school_evidence(text) to authenticated;

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.school_portal_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.school_portal_ready() to authenticated;
