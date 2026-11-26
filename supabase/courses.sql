-- Brazework Courses, phase A: the course core (docs/strategy.md, "Brazework Courses", the founders'
-- decision of 2026-11-26). Run after school-portal.sql. Additive and safe to re-run.
--
-- A class (a community of type 'class', school-portal.sql) gets what a course needs, built around the
-- projects and the verified record:
-- 1. Modules with pages, links and files, published when the professor chooses.
-- 2. Assignments: instructions, a due date, points, an optional rubric (its rows' points add up to the
--    assignment's), individual or group work, and what students may submit: a file, a link, text, or
--    a project milestone (so the graded work also lands on their record once it's verified).
-- 3. Submissions: one per student (or one per project group for group work), resubmittable until the
--    grade is released. Late is worked out from the due date, never stored.
-- 4. Grades: private. A grade is read by the course's staff and, once released, by the student; the
--    school sees only counts (school_courses). Never on a profile, never to anyone else (FERPA).
-- 5. Announcements to the class, and a notification for each (plus one when an assignment is
--    published and when a grade is released).
--
-- Course staff are the class's faculty (owner, admin) and teaching assistants (moderator): rank 3+,
-- the same people who verify class milestones (verification.sql).

-- ---------- Who's who ----------
create or replace function public.is_course_staff(p_cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities c where c.id = p_cid and c.type = 'class') and public.my_rank(p_cid) >= 3
$$;
create or replace function public.in_course(p_cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities c where c.id = p_cid and c.type = 'class') and public.my_rank(p_cid) >= 1
$$;
-- Whether you're on a project's team (on_project_team isn't callable by members; this asks about you only).
create or replace function public.in_my_group(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_project is not null and public.on_project_team(p_project, auth.uid())
$$;
revoke execute on function public.in_my_group(text) from anon, public;
grant execute on function public.in_my_group(text) to authenticated;
revoke execute on function public.is_course_staff(text) from anon, public;
revoke execute on function public.in_course(text) from anon, public;
grant execute on function public.is_course_staff(text) to authenticated;
grant execute on function public.in_course(text) to authenticated;

-- ---------- 1. Modules and their items ----------
create table if not exists public.course_modules (
  id text primary key default gen_random_uuid()::text,
  community_id text not null references public.communities (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  position integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists course_modules_class_idx on public.course_modules (community_id, position);

create table if not exists public.course_items (
  id text primary key default gen_random_uuid()::text,
  module_id text not null references public.course_modules (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  kind text not null check (kind in ('page', 'link', 'file')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://[^\s]+$')),
  path text check (path is null or char_length(path) <= 300),
  size bigint check (size is null or size between 0 and 52428800),
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint course_items_shape check (
    (kind = 'page' and url is null and path is null)
    or (kind = 'link' and url is not null and path is null)
    or (kind = 'file' and url is null and path is not null and path ~ ('^' || community_id || '/materials/[A-Za-z0-9-]{8,64}\.[a-z0-9_]{1,10}$')))
);
create index if not exists course_items_module_idx on public.course_items (module_id, position);
create index if not exists course_items_class_idx on public.course_items (community_id);

-- ---------- 2. Assignments ----------
create table if not exists public.assignments (
  id text primary key default gen_random_uuid()::text,
  community_id text not null references public.communities (id) on delete cascade,
  module_id text references public.course_modules (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  instructions text not null default '' check (char_length(instructions) <= 20000),
  due_at timestamptz,
  points numeric(7, 2) not null default 100 check (points between 0 and 10000),
  group_work boolean not null default false,
  submit_as text[] not null default '{file,link,text}'
    check (cardinality(submit_as) between 1 and 4 and submit_as <@ array['file', 'link', 'text', 'milestone']),
  -- [{ "id": "r1", "criterion": "Analysis", "points": 40, "outcome": "1" }, ...] (outcome: an ABET student
  -- outcome, 1 to 7, for the accreditation export; optional).
  rubric jsonb not null default '[]'::jsonb check (jsonb_typeof(rubric) = 'array' and jsonb_array_length(rubric) <= 20),
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assignments_class_idx on public.assignments (community_id, due_at);
create index if not exists assignments_module_idx on public.assignments (module_id);
create index if not exists assignments_created_by_idx on public.assignments (created_by);

-- A rubric's rows are well formed, and with a rubric the assignment is worth what its rows add up to.
create or replace function public.assignments_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; total numeric := 0; ids text[] := '{}';
begin
  for r in select * from jsonb_array_elements(new.rubric) loop
    if jsonb_typeof(r) <> 'object' or coalesce(char_length(btrim(r->>'criterion')), 0) not between 1 and 200
       or coalesce(r->>'id', '') !~ '^[A-Za-z0-9_-]{1,40}$' or (r->>'id') = any (ids)
       or jsonb_typeof(r->'points') <> 'number' or (r->>'points')::numeric < 0
       or (r ? 'outcome' and coalesce(r->>'outcome', '') !~ '^([1-7])?$') then
      raise exception 'Each rubric row needs a criterion (up to 200 characters) and its points.' using errcode = 'P0001';
    end if;
    ids := ids || (r->>'id');
    total := total + (r->>'points')::numeric;
  end loop;
  if jsonb_array_length(new.rubric) > 0 then new.points := total; end if;
  if new.published and (tg_op = 'INSERT' or not old.published) then new.published_at := now(); end if;
  if tg_op = 'UPDATE' then new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists assignments_before_write on public.assignments;
create trigger assignments_before_write before insert or update on public.assignments
  for each row execute function public.assignments_before_write();

-- ---------- 3. Submissions ----------
create table if not exists public.submissions (
  id text primary key default gen_random_uuid()::text,
  assignment_id text not null references public.assignments (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,          -- who submitted
  project_id text references public.projects (id) on delete set null,          -- group work: the group's project
  body text not null default '' check (char_length(body) <= 20000),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://[^\s]+$')),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  milestone_id text references public.milestones (id) on delete set null,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, uid)
);
create unique index if not exists submissions_group_idx on public.submissions (assignment_id, project_id) where project_id is not null;
create index if not exists submissions_class_idx on public.submissions (community_id);
create index if not exists submissions_uid_idx on public.submissions (uid);
create index if not exists submissions_project_idx on public.submissions (project_id);
create index if not exists submissions_milestone_idx on public.submissions (milestone_id);

-- ---------- 4. Grades (private) ----------
create table if not exists public.grades (
  assignment_id text not null references public.assignments (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  score numeric(7, 2) check (score is null or score between 0 and 100000),
  rubric_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(rubric_scores) = 'object'),
  feedback text not null default '' check (char_length(feedback) <= 10000),
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz not null default now(),
  released boolean not null default false,
  released_at timestamptz,
  primary key (assignment_id, uid)
);
create index if not exists grades_class_idx on public.grades (community_id);
create index if not exists grades_uid_idx on public.grades (uid);
create index if not exists grades_graded_by_idx on public.grades (graded_by);

-- ---------- 5. Announcements ----------
create table if not exists public.course_announcements (
  id text primary key default gen_random_uuid()::text,
  community_id text not null references public.communities (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists course_announcements_class_idx on public.course_announcements (community_id, created_at desc);
create index if not exists course_announcements_author_idx on public.course_announcements (author_id);

-- ---------- Row-level security ----------
alter table public.course_modules enable row level security;
alter table public.course_items enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.grades enable row level security;
alter table public.course_announcements enable row level security;
revoke all on public.course_modules, public.course_items, public.assignments, public.submissions, public.grades, public.course_announcements from anon, authenticated;
grant select, insert, update, delete on public.course_modules, public.course_items, public.assignments to authenticated;
grant select, insert, delete on public.course_announcements to authenticated;
grant select on public.submissions, public.grades to authenticated;   -- written only through submit_assignment and grade_students

-- Modules, items, assignments: the class reads what's published; staff read and write everything.
drop policy if exists "the class reads published modules" on public.course_modules;
create policy "the class reads published modules" on public.course_modules for select to authenticated
  using ((published and public.in_course(community_id)) or public.is_course_staff(community_id));
drop policy if exists "staff add modules" on public.course_modules;
create policy "staff add modules" on public.course_modules for insert to authenticated with check (public.is_course_staff(community_id));
drop policy if exists "staff change modules" on public.course_modules;
create policy "staff change modules" on public.course_modules for update to authenticated
  using (public.is_course_staff(community_id)) with check (public.is_course_staff(community_id));
drop policy if exists "staff remove modules" on public.course_modules;
create policy "staff remove modules" on public.course_modules for delete to authenticated using (public.is_course_staff(community_id));

drop policy if exists "the class reads published items" on public.course_items;
create policy "the class reads published items" on public.course_items for select to authenticated
  using (public.is_course_staff(community_id)
    or (published and public.in_course(community_id) and exists (select 1 from public.course_modules m where m.id = module_id and m.published)));
drop policy if exists "staff add items" on public.course_items;
create policy "staff add items" on public.course_items for insert to authenticated
  with check (public.is_course_staff(community_id) and exists (select 1 from public.course_modules m where m.id = module_id and m.community_id = course_items.community_id));
drop policy if exists "staff change items" on public.course_items;
create policy "staff change items" on public.course_items for update to authenticated
  using (public.is_course_staff(community_id))
  with check (public.is_course_staff(community_id) and exists (select 1 from public.course_modules m where m.id = module_id and m.community_id = course_items.community_id));
drop policy if exists "staff remove items" on public.course_items;
create policy "staff remove items" on public.course_items for delete to authenticated using (public.is_course_staff(community_id));

drop policy if exists "the class reads published assignments" on public.assignments;
create policy "the class reads published assignments" on public.assignments for select to authenticated
  using ((published and public.in_course(community_id)) or public.is_course_staff(community_id));
drop policy if exists "staff add assignments" on public.assignments;
create policy "staff add assignments" on public.assignments for insert to authenticated
  with check (public.is_course_staff(community_id)
    and (module_id is null or exists (select 1 from public.course_modules m where m.id = module_id and m.community_id = assignments.community_id)));
drop policy if exists "staff change assignments" on public.assignments;
create policy "staff change assignments" on public.assignments for update to authenticated
  using (public.is_course_staff(community_id))
  with check (public.is_course_staff(community_id)
    and (module_id is null or exists (select 1 from public.course_modules m where m.id = module_id and m.community_id = assignments.community_id)));
drop policy if exists "staff remove assignments" on public.assignments;
create policy "staff remove assignments" on public.assignments for delete to authenticated using (public.is_course_staff(community_id));

-- A submission: its student, their group (for group work), and the course's staff.
drop policy if exists "student, group and staff read submissions" on public.submissions;
create policy "student, group and staff read submissions" on public.submissions for select to authenticated
  using (uid = auth.uid() or public.is_course_staff(community_id)
    or public.in_my_group(project_id));

-- A grade: the course's staff, and the student once it's released. Nobody else, ever.
drop policy if exists "staff and the released student read grades" on public.grades;
create policy "staff and the released student read grades" on public.grades for select to authenticated
  using (public.is_course_staff(community_id) or (uid = auth.uid() and released));

drop policy if exists "the class reads announcements" on public.course_announcements;
create policy "the class reads announcements" on public.course_announcements for select to authenticated
  using (public.in_course(community_id));
drop policy if exists "staff announce" on public.course_announcements;
create policy "staff announce" on public.course_announcements for insert to authenticated
  with check (public.is_course_staff(community_id) and author_id = auth.uid());
drop policy if exists "staff remove announcements" on public.course_announcements;
create policy "staff remove announcements" on public.course_announcements for delete to authenticated using (public.is_course_staff(community_id));

-- Members only (members-only.sql): an account that hasn't finished signing up reads nothing.
do $$ declare t text; begin
  foreach t in array array['course_modules', 'course_items', 'assignments', 'submissions', 'grades', 'course_announcements'] loop
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I as restrictive for select to authenticated using ((select public.is_member()))', t);
  end loop;
end $$;

-- ---------- Notifications: announcements, new assignments, released grades ----------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'like', 'comment', 'follow', 'connect_request', 'connect_accepted', 'community_request', 'community_approved',
  'milestone_request', 'milestone_verified', 'milestone_declined', 'mention', 'company_view', 'proof_shared',
  'class_announcement', 'assignment_posted', 'grade_released'));

-- Tells the class's students (not its staff) something, as the person who did it.
create or replace function public.notify_class(p_cid text, p_kind text, p_snippet text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles; c public.communities;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into c from public.communities where id = p_cid;
  insert into public.notifications (user_id, actor_id, actor_first, actor_last, kind, community_id, community_name, snippet)
  select m.uid, me.id, coalesce(me.first_name, ''), coalesce(me.last_name, ''), p_kind, p_cid, c.name, left(p_snippet, 200)
    from public.community_members m
   where m.community_id = p_cid and public.role_rank(m.role) < 3 and m.uid is distinct from me.id;
end $$;
revoke execute on function public.notify_class(text, text, text) from anon, public, authenticated;

create or replace function public.course_announcements_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_class(new.community_id, 'class_announcement', new.title);
  return new;
end $$;
drop trigger if exists course_announcements_notify on public.course_announcements;
create trigger course_announcements_notify after insert on public.course_announcements
  for each row execute function public.course_announcements_notify();

create or replace function public.assignments_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform public.notify_class(new.community_id, 'assignment_posted', new.title);
  end if;
  return new;
end $$;
drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify after insert or update of published on public.assignments
  for each row execute function public.assignments_notify();

-- ---------- Submitting ----------
-- Hands in (or replaces) your work for an assignment. Give what the assignment accepts: text, a link,
-- a file you uploaded to course-files/<class>/<you>/..., or one of your milestones in this class. For
-- group work, name your group's project in the class: the group shares one submission. Locked once
-- your grade is released. Returns the submission's id.
create or replace function public.submit_assignment(p_aid text, p_body text default '', p_url text default null,
  p_file_path text default null, p_file_name text default null, p_milestone text default null, p_project text default null)
returns text language plpgsql security definer set search_path = public as $$
declare a public.assignments; v_id text; v_body text := btrim(coalesce(p_body, '')); v_url text := nullif(btrim(coalesce(p_url, '')), '');
        v_file text := nullif(btrim(coalesce(p_file_path, '')), ''); v_ms text := nullif(p_milestone, ''); v_project text := nullif(p_project, '');
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null or not (a.published or public.is_course_staff(a.community_id)) then raise exception 'That assignment isn''t open.' using errcode = 'P0001'; end if;
  if not public.in_course(a.community_id) then raise exception 'Only students in this class can hand it in.' using errcode = '42501'; end if;
  if v_body = '' and v_url is null and v_file is null and v_ms is null then raise exception 'Add your work first.' using errcode = 'P0001'; end if;
  if v_body <> '' and not 'text' = any (a.submit_as) then raise exception 'This assignment doesn''t take text.' using errcode = 'P0001'; end if;
  if v_url is not null and not 'link' = any (a.submit_as) then raise exception 'This assignment doesn''t take a link.' using errcode = 'P0001'; end if;
  if v_file is not null and not 'file' = any (a.submit_as) then raise exception 'This assignment doesn''t take a file.' using errcode = 'P0001'; end if;
  if v_ms is not null and not 'milestone' = any (a.submit_as) then raise exception 'This assignment doesn''t take a milestone.' using errcode = 'P0001'; end if;
  if v_url is not null and (v_url !~* '^https?://[^\s]+$' or char_length(v_url) > 500) then raise exception 'That link doesn''t look right.' using errcode = 'P0001'; end if;
  if v_file is not null and v_file !~ ('^' || a.community_id || '/' || auth.uid()::text || '/[A-Za-z0-9-]{8,64}\.[a-z0-9_]{1,10}$') then
    raise exception 'Upload the file again.' using errcode = 'P0001';
  end if;
  if v_ms is not null and not exists (select 1 from public.milestones m where m.id = v_ms and m.community_id = a.community_id
       and (m.owner_id = auth.uid() or public.on_project_team(m.project_id, auth.uid()))) then
    raise exception 'Pick one of your milestones in this class.' using errcode = 'P0001';
  end if;
  if a.group_work then
    if v_project is null or not exists (select 1 from public.projects p where p.id = v_project and p.community_id = a.community_id)
       or not public.on_project_team(v_project, auth.uid()) then
      raise exception 'This is group work: hand it in from your group''s project in this class.' using errcode = 'P0001';
    end if;
  else
    v_project := null;
  end if;
  if exists (select 1 from public.grades g where g.assignment_id = p_aid and g.released and g.uid = auth.uid()) then
    raise exception 'Your grade for this is out, so it can''t be changed. Ask your professor.' using errcode = 'P0001';
  end if;

  -- The group's submission if there is one (any teammate may replace it), else yours.
  select id into v_id from public.submissions where assignment_id = p_aid and ((v_project is not null and project_id = v_project) or uid = auth.uid()) limit 1;
  if v_id is null then
    insert into public.submissions (assignment_id, community_id, uid, project_id, body, url, file_path, file_name, milestone_id)
    values (p_aid, a.community_id, auth.uid(), v_project, v_body, v_url, v_file, left(nullif(btrim(coalesce(p_file_name, '')), ''), 200), v_ms)
    returning id into v_id;
  else
    update public.submissions set body = v_body, url = v_url, file_path = v_file, file_name = left(nullif(btrim(coalesce(p_file_name, '')), ''), 200),
           milestone_id = v_ms, project_id = v_project, submitted_at = now()
     where id = v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.submit_assignment(text, text, text, text, text, text, text) from anon, public;
grant execute on function public.submit_assignment(text, text, text, text, text, text, text) to authenticated;

-- ---------- Grading ----------
-- Grades one student, or a whole group at once (the same grade for each): a score (or rubric scores,
-- which add up to it), feedback, and whether to release it now. Staff only, and never your own work.
-- Returns how many grades were written.
create or replace function public.grade_students(p_aid text, p_uids uuid[], p_score numeric default null,
  p_rubric jsonb default '{}'::jsonb, p_feedback text default '', p_release boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare a public.assignments; v_score numeric := p_score; v_rubric jsonb := coalesce(p_rubric, '{}'::jsonb); r jsonb; k text; n int := 0; u uuid;
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null then raise exception 'That assignment no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_course_staff(a.community_id) then raise exception 'Only the class''s professor or teaching assistants grade.' using errcode = '42501'; end if;
  if auth.uid() = any (p_uids) then raise exception 'You can''t grade your own work.' using errcode = '42501'; end if;
  if cardinality(p_uids) not between 1 and 20 then raise exception 'Grade one student or one group at a time.' using errcode = 'P0001'; end if;
  if jsonb_typeof(v_rubric) <> 'object' then raise exception 'Rubric scores look wrong.' using errcode = 'P0001'; end if;
  if v_rubric <> '{}'::jsonb then
    -- Each score is for one of the rubric's rows, and no more than the row is worth.
    for k in select jsonb_object_keys(v_rubric) loop
      r := null;
      select x into r from jsonb_array_elements(a.rubric) x where x->>'id' = k;
      if r is null or jsonb_typeof(v_rubric->k) <> 'number' or (v_rubric->>k)::numeric < 0 or (v_rubric->>k)::numeric > (r->>'points')::numeric then
        raise exception 'Each rubric score must be between 0 and what its row is worth.' using errcode = 'P0001';
      end if;
    end loop;
    select sum(value::numeric) into v_score from jsonb_each_text(v_rubric);
  end if;
  if v_score is not null and (v_score < 0 or v_score > 100000) then raise exception 'That score looks wrong.' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_feedback, '')) > 10000 then raise exception 'Feedback can be up to 10,000 characters.' using errcode = 'P0001'; end if;
  foreach u in array p_uids loop
    if not exists (select 1 from public.community_members m where m.community_id = a.community_id and m.uid = u and public.role_rank(m.role) < 3) then
      raise exception 'Everyone you grade must be a student in this class.' using errcode = 'P0001';
    end if;
    insert into public.grades (assignment_id, uid, community_id, score, rubric_scores, feedback, graded_by, graded_at, released, released_at)
    values (p_aid, u, a.community_id, v_score, v_rubric, coalesce(p_feedback, ''), auth.uid(), now(), p_release, case when p_release then now() end)
    on conflict (assignment_id, uid) do update set score = excluded.score, rubric_scores = excluded.rubric_scores, feedback = excluded.feedback,
      graded_by = excluded.graded_by, graded_at = excluded.graded_at,
      released = grades.released or excluded.released,
      released_at = case when grades.released then grades.released_at else excluded.released_at end;
    n := n + 1;
  end loop;
  if p_release then perform public.notify_grades(p_aid, p_uids); end if;
  return n;
end $$;

-- Releases every grade written for an assignment that isn't out yet. Returns how many.
create or replace function public.release_grades(p_aid text) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.assignments; v_uids uuid[];
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null then raise exception 'That assignment no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_course_staff(a.community_id) then raise exception 'Only the class''s professor or teaching assistants release grades.' using errcode = '42501'; end if;
  with r as (update public.grades set released = true, released_at = now() where assignment_id = p_aid and not released returning uid)
  select coalesce(array_agg(uid), '{}') into v_uids from r;
  if cardinality(v_uids) > 0 then perform public.notify_grades(p_aid, v_uids); end if;
  return cardinality(v_uids);
end $$;

create or replace function public.notify_grades(p_aid text, p_uids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles; a public.assignments; c public.communities;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into a from public.assignments where id = p_aid;
  select * into c from public.communities where id = a.community_id;
  insert into public.notifications (user_id, actor_id, actor_first, actor_last, kind, community_id, community_name, snippet)
  select u, me.id, coalesce(me.first_name, ''), coalesce(me.last_name, ''), 'grade_released', c.id, c.name, left(a.title, 200)
    from unnest(p_uids) u where u is distinct from me.id;
end $$;
revoke execute on function public.notify_grades(text, uuid[]) from anon, public, authenticated;
revoke execute on function public.grade_students(text, uuid[], numeric, jsonb, text, boolean) from anon, public;
grant execute on function public.grade_students(text, uuid[], numeric, jsonb, text, boolean) to authenticated;
revoke execute on function public.release_grades(text) from anon, public;
grant execute on function public.release_grades(text) to authenticated;

-- ---------- What's due: every published assignment in your classes, with where you stand ----------
create or replace function public.my_due(p_days integer default 60)
returns table (id text, community_id text, course text, class_name text, title text, due_at timestamptz, points numeric,
               group_work boolean, submitted_at timestamptz, graded boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.community_id, c.course, c.name, a.title, a.due_at, a.points, a.group_work,
         (select s.submitted_at from public.submissions s where s.assignment_id = a.id
            and (s.uid = auth.uid() or (s.project_id is not null and public.on_project_team(s.project_id, auth.uid())))
          order by s.submitted_at desc limit 1),
         exists (select 1 from public.grades g where g.assignment_id = a.id and g.uid = auth.uid() and g.released)
    from public.assignments a
    join public.communities c on c.id = a.community_id and c.type = 'class'
    join public.community_members m on m.community_id = a.community_id and m.uid = auth.uid() and public.role_rank(m.role) < 3
   where a.published and (a.due_at is null or a.due_at > now() - make_interval(days => least(greatest(p_days, 1), 365)))
   order by a.due_at nulls last, c.course, a.title
   limit 100
$$;
revoke execute on function public.my_due(integer) from anon, public;
grant execute on function public.my_due(integer) to authenticated;

-- ---------- The class list for the gradebook (staff only) ----------
-- Each student with their name, and their school email when it's on the class roster (the registrar's
-- key in the grade export). Faculty already hold the roster; nobody else's email is shown.
create or replace function public.course_students(p_cid text) returns table (uid uuid, first_name text, last_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_course_staff(p_cid) then raise exception 'Only the class''s professor or teaching assistants see this.' using errcode = '42501'; end if;
  return query
  select m.uid, p.first_name, p.last_name,
         (select r.email from public.class_roster r join auth.users u on u.id = m.uid and u.email_confirmed_at is not null
           where r.community_id = p_cid and r.email = lower(u.email) limit 1)
    from public.community_members m join public.profiles p on p.id = m.uid
   where m.community_id = p_cid and public.role_rank(m.role) < 3
   order by p.last_name, p.first_name;
end $$;
revoke execute on function public.course_students(text) from anon, public;
grant execute on function public.course_students(text) to authenticated;

-- ---------- The school's view of its courses: counts only, never a student's grade ----------
create or replace function public.school_courses(p_domain text)
returns table (id text, name text, term text, students integer, assignments integer, submissions integer, graded integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.runs_school(p_domain) then raise exception 'Only the school''s Brazework admins see this.' using errcode = '42501'; end if;
  return query
  select c.id, c.name, c.term,
         (select count(*)::int from public.community_members m where m.community_id = c.id and public.role_rank(m.role) < 3),
         (select count(*)::int from public.assignments a where a.community_id = c.id and a.published),
         (select count(*)::int from public.submissions s where s.community_id = c.id),
         (select count(*)::int from public.grades g where g.community_id = c.id and g.released)
    from public.communities c
   where c.type = 'class' and c.school_domain = lower(p_domain)
   order by split_part(c.term, ' ', 2) desc, c.name;
end $$;
revoke execute on function public.school_courses(text) from anon, public;
grant execute on function public.school_courses(text) to authenticated;

-- ---------- Course files (skipped where Storage isn't installed, e.g. the CI database) ----------
-- <class>/materials/<id>.<ext>: staff upload, the class reads.
-- <class>/<student>/<id>.<ext>: the student uploads; they, their group (for a group submission) and the
-- course's staff read it.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('course-files', 'course-files', false, 52428800, null)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute 'drop policy if exists "course files: read in the class" on storage.objects';
    execute $p$create policy "course files: read in the class" on storage.objects for select to authenticated
      using (bucket_id = 'course-files' and (
        public.is_course_staff((storage.foldername(name))[1])
        or ((storage.foldername(name))[2] = 'materials' and public.in_course((storage.foldername(name))[1]))
        or (storage.foldername(name))[2] = auth.uid()::text
        or exists (select 1 from public.submissions s where s.file_path = name and public.in_my_group(s.project_id))))$p$;
    execute 'drop policy if exists "course files: upload" on storage.objects';
    execute $p$create policy "course files: upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'course-files' and public.project_file_ext_ok(storage.extension(name)) and (
        ((storage.foldername(name))[2] = 'materials' and public.is_course_staff((storage.foldername(name))[1]))
        or ((storage.foldername(name))[2] = auth.uid()::text and public.in_course((storage.foldername(name))[1]))))$p$;
    execute 'drop policy if exists "course files: uploader or staff deletes" on storage.objects';
    execute $p$create policy "course files: uploader or staff deletes" on storage.objects for delete to authenticated
      using (bucket_id = 'course-files' and (owner_id = auth.uid()::text or public.is_course_staff((storage.foldername(name))[1])))$p$;
  end if;
end $$;

create or replace function public.courses_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.courses_ready() to anon, authenticated;
