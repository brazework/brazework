-- Brazework Courses, phase B: running a course (docs/strategy.md, "Brazework Courses"). Run after
-- courses.sql. Additive and safe to re-run.
--
-- 1. Quizzes: an assignment of kind 'quiz' carries its questions (choice, several choices, a number
--    with a tolerance, or a short answer). The answers live apart, in quiz_keys, which only the course's
--    staff can read. submit_quiz marks it at once (short answers wait for the professor) and writes the
--    grade, released to the student straight away when the professor chose that.
-- 2. Attendance: class sessions, each with a short check-in code only staff can read; students check in
--    with the code while it's open, and staff mark anyone present, late, absent or excused.
-- 3. Extensions and accommodations: a later due date for one student on one assignment, and extra days
--    on every assignment for a student with an accommodation. due_for() gives each student's real due
--    date, and lateness and quiz closing use it.
-- 4. Peer evaluation: on group work with peer evaluation on, each student rates each teammate (1 to 5,
--    with a comment). Staff read every rating; a student reads only the ratings they gave.
-- 5. ABET outcomes: attainment by outcome from rubric rows tagged with one, for a course (its staff)
--    and for the school (its admins), as aggregates only: students assessed and how well, never a name
--    next to a grade.

-- ---------- 1. Quizzes ----------
alter table public.assignments add column if not exists kind text not null default 'assignment';
alter table public.assignments drop constraint if exists assignments_kind_check;
alter table public.assignments add constraint assignments_kind_check check (kind in ('assignment', 'quiz'));
-- [{ "id": "q1", "prompt": "...", "type": "choice" | "multi" | "number" | "short", "options": ["..."], "points": 2 }]
alter table public.assignments add column if not exists quiz jsonb not null default '[]'::jsonb;
alter table public.assignments drop constraint if exists assignments_quiz_check;
alter table public.assignments add constraint assignments_quiz_check check (jsonb_typeof(quiz) = 'array' and jsonb_array_length(quiz) <= 60);
alter table public.assignments add column if not exists show_score boolean not null default true;
alter table public.assignments add column if not exists peer_eval boolean not null default false;
alter table public.submissions add column if not exists answers jsonb;

-- The answers: { "q1": 2, "q2": [0, 3], "q3": { "value": 9.81, "tolerance": 0.05 } }. Staff only.
create table if not exists public.quiz_keys (
  assignment_id text primary key references public.assignments (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  key jsonb not null default '{}'::jsonb check (jsonb_typeof(key) = 'object')
);
create index if not exists quiz_keys_class_idx on public.quiz_keys (community_id);
alter table public.quiz_keys enable row level security;
revoke all on public.quiz_keys from anon, authenticated;
grant select on public.quiz_keys to authenticated;
drop policy if exists "staff read quiz keys" on public.quiz_keys;
create policy "staff read quiz keys" on public.quiz_keys for select to authenticated using (public.is_course_staff(community_id));

-- Staff set a quiz's questions with their answers; the answers are split off into quiz_keys and the
-- assignment is worth the questions' points.
create or replace function public.set_quiz(p_aid text, p_questions jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.assignments; q jsonb; pub jsonb := '[]'::jsonb; k jsonb := '{}'::jsonb; ids text[] := '{}'; total numeric := 0; n int;
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null then raise exception 'That assignment no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_course_staff(a.community_id) then raise exception 'Only the class''s professor or teaching assistants write quizzes.' using errcode = '42501'; end if;
  if coalesce(jsonb_typeof(p_questions), '') <> 'array' or jsonb_array_length(p_questions) not between 1 and 60 then raise exception 'A quiz has 1 to 60 questions.' using errcode = 'P0001'; end if;
  for q in select * from jsonb_array_elements(p_questions) loop
    if coalesce(q->>'id', '') !~ '^[A-Za-z0-9_-]{1,40}$' or (q->>'id') = any (ids) then raise exception 'Each question needs its own id.' using errcode = 'P0001'; end if;
    if coalesce(char_length(btrim(q->>'prompt')), 0) not between 1 and 2000 then raise exception 'Each question needs its words (up to 2,000 characters).' using errcode = 'P0001'; end if;
    if coalesce(q->>'type', '') not in ('choice', 'multi', 'number', 'short') then raise exception 'A question is multiple choice, several choices, a number or a short answer.' using errcode = 'P0001'; end if;
    if coalesce(jsonb_typeof(q->'points'), '') <> 'number' or (q->>'points')::numeric <= 0 or (q->>'points')::numeric > 1000 then raise exception 'Each question is worth some points.' using errcode = 'P0001'; end if;
    n := case when jsonb_typeof(q->'options') = 'array' then jsonb_array_length(q->'options') else 0 end;
    if q->>'type' in ('choice', 'multi') then
      if n not between 2 and 10 then raise exception 'A choice question has 2 to 10 options.' using errcode = 'P0001'; end if;
      if q->>'type' = 'choice' and (coalesce(jsonb_typeof(q->'answer'), '') <> 'number' or (q->>'answer')::int not between 0 and n - 1) then raise exception 'Mark the right option for each multiple-choice question.' using errcode = 'P0001'; end if;
      if q->>'type' = 'multi' and (coalesce(jsonb_typeof(q->'answer'), '') <> 'array' or jsonb_array_length(q->'answer') < 1
          or exists (select 1 from jsonb_array_elements(q->'answer') x where jsonb_typeof(x) <> 'number' or x::text::int not between 0 and n - 1)) then
        raise exception 'Mark the right options for each several-choices question.' using errcode = 'P0001';
      end if;
    elsif q->>'type' = 'number' then
      if coalesce(jsonb_typeof(q->'answer'), '') <> 'number' then raise exception 'Give the right number for each number question.' using errcode = 'P0001'; end if;
    end if;
    ids := ids || (q->>'id');
    total := total + (q->>'points')::numeric;
    pub := pub || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id', q->>'id', 'prompt', btrim(q->>'prompt'), 'type', q->>'type',
             'options', case when n > 0 then q->'options' end, 'points', (q->>'points')::numeric)));
    if q->>'type' = 'number' then
      k := k || jsonb_build_object(q->>'id', jsonb_build_object('value', q->'answer', 'tolerance', coalesce(nullif(q->>'tolerance', '')::numeric, 0)));
    elsif q->>'type' <> 'short' then
      k := k || jsonb_build_object(q->>'id', q->'answer');
    end if;
  end loop;
  update public.assignments set kind = 'quiz', quiz = pub, rubric = '[]'::jsonb, points = total, submit_as = '{text}' where id = p_aid;
  insert into public.quiz_keys (assignment_id, community_id, key) values (p_aid, a.community_id, k)
  on conflict (assignment_id) do update set key = excluded.key;
  return jsonb_array_length(pub);
end $$;
revoke execute on function public.set_quiz(text, jsonb) from anon, public;
grant execute on function public.set_quiz(text, jsonb) to authenticated;

-- With a rubric the points are the rows' total (courses.sql); a quiz keeps its questions' total.
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
  if new.kind = 'quiz' and jsonb_array_length(new.quiz) > 0 then
    select coalesce(sum((q->>'points')::numeric), 0) into new.points from jsonb_array_elements(new.quiz) q;
  end if;
  if new.published and (tg_op = 'INSERT' or not old.published) then new.published_at := now(); end if;
  if tg_op = 'UPDATE' then new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end $$;

-- A quiz is taken with submit_quiz, never handed in like an assignment.
create or replace function public.submissions_quiz_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.answers is null and exists (select 1 from public.assignments a where a.id = new.assignment_id and a.kind = 'quiz') then
    raise exception 'Take the quiz from its page.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists submissions_quiz_guard on public.submissions;
create trigger submissions_quiz_guard before insert or update on public.submissions
  for each row execute function public.submissions_quiz_guard();

-- ---------- 3. Extensions and accommodations (before quizzes use them) ----------
create table if not exists public.course_accommodations (
  community_id text not null references public.communities (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  extra_days integer not null default 0 check (extra_days between 0 and 60),
  extra_time_pct integer not null default 0 check (extra_time_pct between 0 and 300),
  note text not null default '' check (char_length(note) <= 500),
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (community_id, uid)
);
create index if not exists course_accommodations_uid_idx on public.course_accommodations (uid);
create index if not exists course_accommodations_set_by_idx on public.course_accommodations (set_by);

create table if not exists public.assignment_extensions (
  assignment_id text not null references public.assignments (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  due_at timestamptz not null,
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (assignment_id, uid)
);
create index if not exists assignment_extensions_uid_idx on public.assignment_extensions (uid);
create index if not exists assignment_extensions_class_idx on public.assignment_extensions (community_id);
create index if not exists assignment_extensions_set_by_idx on public.assignment_extensions (set_by);

alter table public.course_accommodations enable row level security;
alter table public.assignment_extensions enable row level security;
revoke all on public.course_accommodations, public.assignment_extensions from anon, authenticated;
grant select on public.course_accommodations, public.assignment_extensions to authenticated;
drop policy if exists "staff and the student read accommodations" on public.course_accommodations;
create policy "staff and the student read accommodations" on public.course_accommodations for select to authenticated
  using (uid = auth.uid() or public.is_course_staff(community_id));
drop policy if exists "staff and the student read extensions" on public.assignment_extensions;
create policy "staff and the student read extensions" on public.assignment_extensions for select to authenticated
  using (uid = auth.uid() or public.is_course_staff(community_id));

-- A student's real due date for an assignment: their extension, else the due date plus any
-- accommodation's extra days.
create or replace function public.due_for(p_aid text, p_uid uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.due_at from public.assignment_extensions e where e.assignment_id = p_aid and e.uid = p_uid),
    (select a.due_at + make_interval(days => coalesce((select ac.extra_days from public.course_accommodations ac where ac.community_id = a.community_id and ac.uid = p_uid), 0))
       from public.assignments a where a.id = p_aid))
$$;
revoke execute on function public.due_for(text, uuid) from anon, public;
grant execute on function public.due_for(text, uuid) to authenticated;

create or replace function public.set_accommodation(p_cid text, p_uid uuid, p_extra_days integer, p_extra_time_pct integer default 0, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_course_staff(p_cid) then raise exception 'Only the class''s professor or teaching assistants set accommodations.' using errcode = '42501'; end if;
  if not exists (select 1 from public.community_members m where m.community_id = p_cid and m.uid = p_uid and public.role_rank(m.role) < 3) then
    raise exception 'That student isn''t in this class.' using errcode = 'P0001';
  end if;
  if coalesce(p_extra_days, 0) = 0 and coalesce(p_extra_time_pct, 0) = 0 then
    delete from public.course_accommodations where community_id = p_cid and uid = p_uid;
    return;
  end if;
  if p_extra_days not between 0 and 60 or p_extra_time_pct not between 0 and 300 then raise exception 'Extra days are 0 to 60, extra time 0 to 300%%.' using errcode = 'P0001'; end if;
  insert into public.course_accommodations (community_id, uid, extra_days, extra_time_pct, note, set_by, set_at)
  values (p_cid, p_uid, p_extra_days, p_extra_time_pct, left(coalesce(p_note, ''), 500), auth.uid(), now())
  on conflict (community_id, uid) do update set extra_days = excluded.extra_days, extra_time_pct = excluded.extra_time_pct,
    note = excluded.note, set_by = excluded.set_by, set_at = excluded.set_at;
end $$;
revoke execute on function public.set_accommodation(text, uuid, integer, integer, text) from anon, public;
grant execute on function public.set_accommodation(text, uuid, integer, integer, text) to authenticated;

create or replace function public.set_extension(p_aid text, p_uid uuid, p_due_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare a public.assignments;
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null then raise exception 'That assignment no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_course_staff(a.community_id) then raise exception 'Only the class''s professor or teaching assistants give extensions.' using errcode = '42501'; end if;
  if not exists (select 1 from public.community_members m where m.community_id = a.community_id and m.uid = p_uid and public.role_rank(m.role) < 3) then
    raise exception 'That student isn''t in this class.' using errcode = 'P0001';
  end if;
  if p_due_at is null then
    delete from public.assignment_extensions where assignment_id = p_aid and uid = p_uid;
    return;
  end if;
  insert into public.assignment_extensions (assignment_id, uid, community_id, due_at, set_by, set_at)
  values (p_aid, p_uid, a.community_id, p_due_at, auth.uid(), now())
  on conflict (assignment_id, uid) do update set due_at = excluded.due_at, set_by = excluded.set_by, set_at = excluded.set_at;
end $$;
revoke execute on function public.set_extension(text, uuid, timestamptz) from anon, public;
grant execute on function public.set_extension(text, uuid, timestamptz) to authenticated;

-- ---------- Taking a quiz ----------
-- Marks your answers at once: one option, several options (all right to score), a number within the
-- tolerance. Short answers score 0 until the professor grades them. One attempt, before your due date.
-- Returns your score (null if the professor hides scores until release).
create or replace function public.submit_quiz(p_aid text, p_answers jsonb) returns numeric
language plpgsql security definer set search_path = public as $$
declare a public.assignments; k jsonb; q jsonb; ans jsonb; right_ jsonb; score numeric := 0; has_short boolean := false; due timestamptz;
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null or a.kind <> 'quiz' or not a.published then raise exception 'That quiz isn''t open.' using errcode = 'P0001'; end if;
  if not public.in_course(a.community_id) or public.is_course_staff(a.community_id) then raise exception 'Only students in this class take the quiz.' using errcode = '42501'; end if;
  due := public.due_for(p_aid, auth.uid());
  if due is not null and now() > due then raise exception 'This quiz closed at its due date. Ask your professor for an extension.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.submissions s where s.assignment_id = p_aid and s.uid = auth.uid()) then raise exception 'You''ve already taken this quiz.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 100000 then raise exception 'Those answers look wrong.' using errcode = 'P0001'; end if;
  select key into k from public.quiz_keys where assignment_id = p_aid;
  k := coalesce(k, '{}'::jsonb);
  for q in select * from jsonb_array_elements(a.quiz) loop
    ans := p_answers -> (q->>'id');
    right_ := k -> (q->>'id');
    if q->>'type' = 'short' then has_short := true; continue; end if;
    if ans is null or right_ is null then continue; end if;
    if q->>'type' = 'choice' and jsonb_typeof(ans) = 'number' and ans = right_ then
      score := score + (q->>'points')::numeric;
    elsif q->>'type' = 'multi' and jsonb_typeof(ans) = 'array'
      and (select coalesce(array_agg(x::text::int order by x::text::int), '{}') from (select distinct x from jsonb_array_elements(ans) x) d)
        = (select coalesce(array_agg(x::text::int order by x::text::int), '{}') from (select distinct x from jsonb_array_elements(right_) x) d) then
      score := score + (q->>'points')::numeric;
    elsif q->>'type' = 'number' and jsonb_typeof(ans) = 'number'
      and abs((ans::text)::numeric - (right_->>'value')::numeric) <= coalesce((right_->>'tolerance')::numeric, 0) then
      score := score + (q->>'points')::numeric;
    end if;
  end loop;
  insert into public.submissions (assignment_id, community_id, uid, body, answers)
  values (p_aid, a.community_id, auth.uid(), '', p_answers);
  insert into public.grades (assignment_id, uid, community_id, score, feedback, graded_by, graded_at, released, released_at)
  values (p_aid, auth.uid(), a.community_id, score, case when has_short then 'Marked automatically. Short answers wait for your professor.' else 'Marked automatically.' end,
          null, now(), a.show_score and not has_short, case when a.show_score and not has_short then now() end);
  return case when a.show_score and not has_short then score end;
end $$;
revoke execute on function public.submit_quiz(text, jsonb) from anon, public;
grant execute on function public.submit_quiz(text, jsonb) to authenticated;

-- ---------- 2. Attendance ----------
create table if not exists public.course_sessions (
  id text primary key default gen_random_uuid()::text,
  community_id text not null references public.communities (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  held_on date not null default current_date,
  code text not null default upper(substr(md5(random()::text), 1, 6)) check (code ~ '^[A-Z0-9]{4,8}$'),
  open_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists course_sessions_class_idx on public.course_sessions (community_id, held_on desc);

create table if not exists public.attendance (
  session_id text not null references public.course_sessions (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  marked_by uuid references public.profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (session_id, uid)
);
create index if not exists attendance_uid_idx on public.attendance (uid);
create index if not exists attendance_class_idx on public.attendance (community_id);
create index if not exists attendance_marked_by_idx on public.attendance (marked_by);

alter table public.course_sessions enable row level security;
alter table public.attendance enable row level security;
revoke all on public.course_sessions, public.attendance from anon, authenticated;
-- Students see the sessions, never their codes (column grants); staff read codes through course_session_codes.
grant select (id, community_id, title, held_on, open_until, created_at) on public.course_sessions to authenticated;
grant select on public.attendance to authenticated;
drop policy if exists "the class reads sessions" on public.course_sessions;
create policy "the class reads sessions" on public.course_sessions for select to authenticated using (public.in_course(community_id));
drop policy if exists "staff and the student read attendance" on public.attendance;
create policy "staff and the student read attendance" on public.attendance for select to authenticated
  using (uid = auth.uid() or public.is_course_staff(community_id));

-- Staff open a session: a check-in code, open for the minutes they choose (0: no self check-in).
create or replace function public.open_session(p_cid text, p_title text default '', p_minutes integer default 15) returns text
language plpgsql security definer set search_path = public as $$
declare sid text;
begin
  if not public.is_course_staff(p_cid) then raise exception 'Only the class''s professor or teaching assistants take attendance.' using errcode = '42501'; end if;
  if p_minutes not between 0 and 240 then raise exception 'Keep check-in open for up to 4 hours.' using errcode = 'P0001'; end if;
  insert into public.course_sessions (community_id, title, open_until)
  values (p_cid, left(btrim(coalesce(p_title, '')), 120), case when p_minutes > 0 then now() + make_interval(mins => p_minutes) end)
  returning id into sid;
  return sid;
end $$;
revoke execute on function public.open_session(text, text, integer) from anon, public;
grant execute on function public.open_session(text, text, integer) to authenticated;

-- The codes, for staff to put on the screen.
create or replace function public.course_session_codes(p_cid text) returns table (id text, code text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_course_staff(p_cid) then raise exception 'Only the class''s professor or teaching assistants see check-in codes.' using errcode = '42501'; end if;
  return query select s.id, s.code from public.course_sessions s where s.community_id = p_cid order by s.held_on desc, s.created_at desc limit 100;
end $$;
revoke execute on function public.course_session_codes(text) from anon, public;
grant execute on function public.course_session_codes(text) to authenticated;

-- A student checks in with the code on the screen, while it's open. Returns the class's name.
create or replace function public.check_in(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare s public.course_sessions; c public.communities;
begin
  select cs.* into s from public.course_sessions cs
   where cs.code = upper(btrim(coalesce(p_code, ''))) and cs.open_until > now() and public.in_course(cs.community_id) and not public.is_course_staff(cs.community_id)
   order by cs.created_at desc limit 1;
  if s.id is null then raise exception 'That code isn''t open for any of your classes. Check it, or ask your professor.' using errcode = 'P0001'; end if;
  insert into public.attendance (session_id, uid, community_id, status, marked_by)
  values (s.id, auth.uid(), s.community_id, 'present', auth.uid())
  on conflict (session_id, uid) do nothing;
  select * into c from public.communities where id = s.community_id;
  return c.name;
end $$;
revoke execute on function public.check_in(text) from anon, public;
grant execute on function public.check_in(text) to authenticated;

-- Staff mark (or change) anyone's attendance for a session.
create or replace function public.mark_attendance(p_sid text, p_uid uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.course_sessions;
begin
  select * into s from public.course_sessions where id = p_sid;
  if s.id is null then raise exception 'That session no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_course_staff(s.community_id) then raise exception 'Only the class''s professor or teaching assistants take attendance.' using errcode = '42501'; end if;
  if p_status not in ('present', 'late', 'absent', 'excused') then raise exception 'Present, late, absent or excused.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.community_members m where m.community_id = s.community_id and m.uid = p_uid and public.role_rank(m.role) < 3) then
    raise exception 'That student isn''t in this class.' using errcode = 'P0001';
  end if;
  insert into public.attendance (session_id, uid, community_id, status, marked_by, marked_at)
  values (p_sid, p_uid, s.community_id, p_status, auth.uid(), now())
  on conflict (session_id, uid) do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at;
end $$;
revoke execute on function public.mark_attendance(text, uuid, text) from anon, public;
grant execute on function public.mark_attendance(text, uuid, text) to authenticated;

create or replace function public.close_session(p_sid text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.course_sessions;
begin
  select * into s from public.course_sessions where id = p_sid;
  if s.id is null or not public.is_course_staff(s.community_id) then raise exception 'Only the class''s professor or teaching assistants close check-in.' using errcode = '42501'; end if;
  update public.course_sessions set open_until = least(coalesce(open_until, now()), now()) where id = p_sid;
end $$;
revoke execute on function public.close_session(text) from anon, public;
grant execute on function public.close_session(text) to authenticated;

-- ---------- 4. Peer evaluation ----------
create table if not exists public.peer_reviews (
  assignment_id text not null references public.assignments (id) on delete cascade,
  reviewer uuid not null references public.profiles (id) on delete cascade,
  reviewee uuid not null references public.profiles (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  primary key (assignment_id, reviewer, reviewee),
  check (reviewer <> reviewee)
);
create index if not exists peer_reviews_reviewee_idx on public.peer_reviews (reviewee);
create index if not exists peer_reviews_reviewer_idx on public.peer_reviews (reviewer);
create index if not exists peer_reviews_class_idx on public.peer_reviews (community_id);
alter table public.peer_reviews enable row level security;
revoke all on public.peer_reviews from anon, authenticated;
grant select on public.peer_reviews to authenticated;
drop policy if exists "staff and the reviewer read peer reviews" on public.peer_reviews;
create policy "staff and the reviewer read peer reviews" on public.peer_reviews for select to authenticated
  using (reviewer = auth.uid() or public.is_course_staff(community_id));

-- Rate a teammate on a group assignment with peer evaluation on: someone on your project in this class.
create or replace function public.submit_peer_review(p_aid text, p_reviewee uuid, p_score integer, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare a public.assignments;
begin
  select * into a from public.assignments where id = p_aid;
  if a.id is null or not a.published or not a.group_work or not a.peer_eval then raise exception 'This assignment doesn''t ask for peer evaluation.' using errcode = 'P0001'; end if;
  if not public.in_course(a.community_id) or public.is_course_staff(a.community_id) then raise exception 'Only students in this class rate teammates.' using errcode = '42501'; end if;
  if p_reviewee = auth.uid() then raise exception 'Rate your teammates, not yourself.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.projects p where p.community_id = a.community_id
                  and public.on_project_team(p.id, auth.uid()) and public.on_project_team(p.id, p_reviewee)) then
    raise exception 'Rate the people on your project in this class.' using errcode = 'P0001';
  end if;
  if p_score not between 1 and 5 then raise exception 'Rate from 1 to 5.' using errcode = 'P0001'; end if;
  insert into public.peer_reviews (assignment_id, reviewer, reviewee, community_id, score, comment)
  values (p_aid, auth.uid(), p_reviewee, a.community_id, p_score, left(coalesce(p_comment, ''), 2000))
  on conflict (assignment_id, reviewer, reviewee) do update set score = excluded.score, comment = excluded.comment, created_at = now();
end $$;
revoke execute on function public.submit_peer_review(text, uuid, integer, text) from anon, public;
grant execute on function public.submit_peer_review(text, uuid, integer, text) to authenticated;

-- Your teammates for an assignment (for the rating form): names only.
create or replace function public.my_teammates(p_aid text) returns table (uid uuid, first_name text, last_name text)
language sql stable security definer set search_path = public as $$
  select distinct p2.id, p2.first_name, p2.last_name
    from public.assignments a
    join public.projects p on p.community_id = a.community_id and public.on_project_team(p.id, auth.uid())
    join public.profiles p2 on public.on_project_team(p.id, p2.id) and p2.id <> auth.uid()
   where a.id = p_aid and public.in_course(a.community_id)
$$;
revoke execute on function public.my_teammates(text) from anon, public;
grant execute on function public.my_teammates(text) to authenticated;

-- ---------- 5. ABET outcomes: attainment, never a name ----------
-- Every released grade's rubric score on a row tagged with an outcome, as a share of the row's points.
create or replace function public.outcome_scores(p_where_cid text, p_domain text)
returns table (community_id text, outcome text, uid uuid, pct numeric)
language sql stable security definer set search_path = public as $$
  select g.community_id, r->>'outcome', g.uid, ((g.rubric_scores->>(r->>'id'))::numeric / nullif((r->>'points')::numeric, 0)) * 100
    from public.grades g
    join public.assignments a on a.id = g.assignment_id
    join public.communities c on c.id = g.community_id
    cross join lateral jsonb_array_elements(a.rubric) r
   where g.released and coalesce(r->>'outcome', '') <> '' and g.rubric_scores ? (r->>'id')
     and (p_where_cid is null or g.community_id = p_where_cid)
     and (p_domain is null or c.school_domain = lower(p_domain))
$$;
revoke execute on function public.outcome_scores(text, text) from anon, public, authenticated;

-- (An earlier draft of these, never released, had other columns.)
drop function if exists public.course_outcomes(text);
drop function if exists public.school_outcomes(text);

-- A course's attainment by outcome, for its staff: students assessed, average, share at 70% or more.
create or replace function public.course_outcomes(p_cid text) returns table (outcome text, students integer, average numeric, meeting numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_course_staff(p_cid) then raise exception 'Only the class''s professor or teaching assistants see this.' using errcode = '42501'; end if;
  return query
  with per as (select o.outcome, o.uid, avg(o.pct) pct from public.outcome_scores(p_cid, null) o group by o.outcome, o.uid)
  select per.outcome, count(*)::int, round(avg(per.pct), 1), round(100.0 * count(*) filter (where per.pct >= 70) / count(*), 1)
    from per group by per.outcome order by per.outcome;
end $$;
revoke execute on function public.course_outcomes(text) from anon, public;
grant execute on function public.course_outcomes(text) to authenticated;

-- The school's attainment by outcome and course, for its admins (the accreditation self-study table).
-- Courses with fewer than 3 students assessed on an outcome are left out, so no one is identifiable.
create or replace function public.school_outcomes(p_domain text) returns table (outcome text, course text, term text, students integer, average numeric, meeting numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.runs_school(p_domain) then raise exception 'Only the school''s Brazework admins see this.' using errcode = '42501'; end if;
  return query
  with per as (select o.community_id, o.outcome, o.uid, avg(o.pct) pct from public.outcome_scores(null, p_domain) o group by o.community_id, o.outcome, o.uid)
  select per.outcome, c.name, c.term, count(*)::int, round(avg(per.pct), 1), round(100.0 * count(*) filter (where per.pct >= 70) / count(*), 1)
    from per join public.communities c on c.id = per.community_id
   group by per.outcome, c.name, c.term
  having count(*) >= 3
   order by per.outcome, c.term, c.name;
end $$;
revoke execute on function public.school_outcomes(text) from anon, public;
grant execute on function public.school_outcomes(text) to authenticated;

-- ---------- What's due uses each student's real due date ----------
drop function if exists public.my_due(integer);
create or replace function public.my_due(p_days integer default 60)
returns table (id text, community_id text, course text, class_name text, title text, due_at timestamptz, points numeric,
               group_work boolean, submitted_at timestamptz, graded boolean, kind text)
language sql stable security definer set search_path = public as $$
  select a.id, a.community_id, c.course, c.name, a.title, public.due_for(a.id, auth.uid()), a.points, a.group_work,
         (select s.submitted_at from public.submissions s where s.assignment_id = a.id
            and (s.uid = auth.uid() or (s.project_id is not null and public.on_project_team(s.project_id, auth.uid())))
          order by s.submitted_at desc limit 1),
         exists (select 1 from public.grades g where g.assignment_id = a.id and g.uid = auth.uid() and g.released),
         a.kind
    from public.assignments a
    join public.communities c on c.id = a.community_id and c.type = 'class'
    join public.community_members m on m.community_id = a.community_id and m.uid = auth.uid() and public.role_rank(m.role) < 3
   where a.published and (a.due_at is null or public.due_for(a.id, auth.uid()) > now() - make_interval(days => least(greatest(p_days, 1), 365)))
   order by 6 nulls last, c.course, a.title
   limit 100
$$;
revoke execute on function public.my_due(integer) from anon, public;
grant execute on function public.my_due(integer) to authenticated;

-- ---------- Members only ----------
do $$ declare t text; begin
  foreach t in array array['quiz_keys', 'course_accommodations', 'assignment_extensions', 'course_sessions', 'attendance', 'peer_reviews'] loop
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I as restrictive for select to authenticated using ((select public.is_member()))', t);
  end loop;
end $$;

create or replace function public.courses_b_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.courses_b_ready() to anon, authenticated;
