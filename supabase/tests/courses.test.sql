-- Brazework Courses, phase A (courses.sql): modules, assignments, submissions, private grades,
-- announcements, what's due, and the school's counts. Run inside a transaction and rolled back.
-- Uses the seeded test members (ben, maya, cara, josh as "leo").
begin;
create temp table t_ids as
  select (select id from auth.users where email = 'ben@forge.test') ben,
         (select id from auth.users where email = 'maya@forge.test') maya,
         (select id from auth.users where email = 'cara@forge.test') cara,
         (select id from auth.users where email = 'josh@forge.test') leo;
grant select on t_ids to authenticated;
create temp table t (k text primary key, v text);
grant all on t to authenticated;

-- Maya is a professor at ucourse.edu; Ben and Leo are students in her class; Cara is at the school
-- but not in the class (and later its Brazework admin).
update auth.users set email = 'maya@ucourse.edu', email_confirmed_at = now() where id = (select maya from t_ids);
update auth.users set email = 'ben@ucourse.edu', email_confirmed_at = now() where id = (select ben from t_ids);
update auth.users set email = 'josh@ucourse.edu', email_confirmed_at = now() where id = (select leo from t_ids);
update auth.users set email = 'cara@ucourse.edu', email_confirmed_at = now() where id = (select cara from t_ids);
insert into public.school_faculty (domain, email, name) values ('ucourse.edu', 'maya@ucourse.edu', 'Maya Ortiz') on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ declare c text; m text; a text; g text; begin
  c := public.create_class('ME 410', 'Capstone Design', 'Fall 2026');
  perform public.set_class_roster(c, array['ben@ucourse.edu', 'josh@ucourse.edu']);
  insert into t values ('class', c);
  -- 1. A module (a draft until published), a page in it, and two assignments.
  insert into public.course_modules (community_id, title) values (c, 'Week 1: Requirements') returning id into m;
  insert into public.course_items (module_id, community_id, kind, title, body) values (m, c, 'page', 'Read me first', 'How this course runs.');
  insert into public.assignments (community_id, module_id, title, due_at, submit_as, rubric, published)
  values (c, m, 'Requirements memo', now() + interval '7 days', '{text,link,milestone}',
          '[{"id":"r1","criterion":"Customer needs","points":30,"outcome":"2"},{"id":"r2","criterion":"Writing","points":20}]', true)
  returning id into a;
  insert into t values ('module', m), ('memo', a);
  if (select points from public.assignments where id = a) <> 50 then raise exception 'FAILED: points should be the rubric''s total'; end if;
  insert into public.assignments (community_id, title, points, group_work, submit_as, published)
  values (c, 'Prototype demo', 100, true, '{link}', true) returning id into g;
  insert into t values ('demo', g);
  -- A malformed rubric is refused.
  begin
    insert into public.assignments (community_id, title, rubric) values (c, 'Bad', '[{"id":"x","criterion":"","points":5}]');
    raise exception 'FAILED: a rubric row with no criterion';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  insert into public.course_announcements (community_id, title, body) values (c, 'Welcome', 'Groups by Friday.');
end $$;

-- 2. Ben, a student: sees published work only, can't write the course, gets the notifications.
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ declare c text := (select v from t where k = 'class'); n int; begin
  if (select count(*) from public.course_modules where community_id = c) <> 0 then raise exception 'FAILED: a student saw a draft module'; end if;
  if (select count(*) from public.assignments where community_id = c) <> 2 then raise exception 'FAILED: a student should see 2 published assignments'; end if;
  if (select count(*) from public.course_announcements where community_id = c) <> 1 then raise exception 'FAILED: a student should see the announcement'; end if;
  if (select count(*) from public.notifications where user_id = auth.uid() and community_id = c and kind in ('class_announcement', 'assignment_posted')) <> 3 then
    raise exception 'FAILED: notifications for the announcement and two assignments';
  end if;
  begin insert into public.course_modules (community_id, title) values (c, 'Hack'); raise exception 'FAILED: a student added a module';
  exception when insufficient_privilege then null; end;
  begin insert into public.course_announcements (community_id, title, body) values (c, 'Hi', 'All'); raise exception 'FAILED: a student announced';
  exception when insufficient_privilege then null; end;
  update public.assignments set points = 1 where community_id = c;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: a student changed an assignment'; end if;
end $$;
-- Maya publishes the module: now Ben sees it and its page.
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
update public.course_modules set published = true where id = (select v from t where k = 'module');
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from public.course_items where module_id = (select v from t where k = 'module')) <> 1 then raise exception 'FAILED: the published page'; end if;
end $$;

-- 3. Submitting: what the assignment takes, and group work through the group's project.
do $$ declare c text := (select v from t where k = 'class'); a text := (select v from t where k = 'memo'); g text := (select v from t where k = 'demo'); p text; s1 text; s2 text; begin
  begin perform public.submit_assignment(a, '', null, 'x/y/z.pdf'); raise exception 'FAILED: a file where files aren''t taken';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  s1 := public.submit_assignment(a, 'Draft one');
  s2 := public.submit_assignment(a, 'Draft two', 'https://docs.example.com/memo');
  if s1 <> s2 or (select body from public.submissions where id = s1) <> 'Draft two' then raise exception 'FAILED: resubmitting replaces'; end if;
  insert into t values ('ben_memo', s1);
  -- Group work needs the group's project in this class.
  begin perform public.submit_assignment(g, '', 'https://youtu.be/demo'); raise exception 'FAILED: group work without a project';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  insert into public.projects (title, summary, community_id, private) values ('Gripper', 'A compliant gripper for ME 410.', c, true) returning id into p;
  insert into t values ('project', p);
  insert into t values ('group_sub', public.submit_assignment(g, '', 'https://youtu.be/demo', null, null, null, p));
end $$;
-- Leo joins Ben's group (set directly here; the project page does it in the app).
reset role;
insert into public.project_members (project_id, uid) select (select v from t where k = 'project'), leo from t_ids on conflict do nothing;
set local role authenticated;
-- Leo, Ben's teammate, sees the group's submission and replaces it; he can't see Ben's memo.
select set_config('request.jwt.claims', json_build_object('sub', (select leo from t_ids), 'role', 'authenticated')::text, true);
do $$ declare g text := (select v from t where k = 'demo'); p text := (select v from t where k = 'project'); begin
  if (select count(*) from public.submissions where assignment_id = g) <> 1 then raise exception 'FAILED: a teammate should see the group submission'; end if;
  if public.submit_assignment(g, '', 'https://youtu.be/demo2', null, null, null, p) <> (select v from t where k = 'group_sub') then raise exception 'FAILED: the group shares one submission'; end if;
  if exists (select 1 from public.submissions where id = (select v from t where k = 'ben_memo')) then raise exception 'FAILED: a classmate saw Ben''s memo'; end if;
end $$;

-- 4. Grading: staff only, rubric scores add up, grades stay hidden until released.
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.grade_students((select v from t where k = 'memo'), array[(select ben from t_ids)], 50); raise exception 'FAILED: a student graded';
  exception when insufficient_privilege then null; end;
  begin perform public.course_students((select v from t where k = 'class')); raise exception 'FAILED: a student read the class list';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ declare a text := (select v from t where k = 'memo'); g text := (select v from t where k = 'demo'); begin
  if (select count(*) from public.submissions where assignment_id = a) <> 1 then raise exception 'FAILED: faculty see submissions'; end if;
  begin perform public.grade_students(a, array[(select ben from t_ids)], null, '{"r1": 31}'); raise exception 'FAILED: a rubric score above its row';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  begin perform public.grade_students(a, array[(select cara from t_ids)], 10); raise exception 'FAILED: graded someone not in the class';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  if (select count(*) from public.course_students((select v from t where k = 'class')) where email = 'ben@ucourse.edu') <> 1 then raise exception 'FAILED: course_students'; end if;
  perform public.grade_students(a, array[(select ben from t_ids)], null, '{"r1": 27, "r2": 18}', 'Strong needs list.');
  if (select score from public.grades where assignment_id = a and uid = (select ben from t_ids)) <> 45 then raise exception 'FAILED: rubric scores add up'; end if;
  if public.grade_students(g, array[(select ben from t_ids), (select leo from t_ids)], 92, '{}', 'Clean demo.', true) <> 2 then raise exception 'FAILED: grading a group'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if exists (select 1 from public.grades where assignment_id = (select v from t where k = 'memo')) then raise exception 'FAILED: an unreleased grade showed'; end if;
  if (select score from public.grades where assignment_id = (select v from t where k = 'demo')) <> 92 then raise exception 'FAILED: a released grade should show'; end if;
  if (select count(*) from public.grades where community_id = (select v from t where k = 'class')) <> 1 then raise exception 'FAILED: Ben saw someone else''s grade'; end if;
  if not exists (select 1 from public.notifications where user_id = auth.uid() and kind = 'grade_released') then raise exception 'FAILED: grade notification'; end if;
  -- Locked once released.
  begin perform public.submit_assignment((select v from t where k = 'demo'), '', 'https://youtu.be/late', null, null, null, (select v from t where k = 'project'));
    raise exception 'FAILED: resubmitted after the grade was out';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  -- What's due: both assignments, with where Ben stands.
  if (select count(*) from public.my_due()) <> 2 then raise exception 'FAILED: my_due'; end if;
  if (select submitted_at is null from public.my_due() where id = (select v from t where k = 'memo')) then raise exception 'FAILED: my_due should show the memo handed in'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if public.release_grades((select v from t where k = 'memo')) <> 1 then raise exception 'FAILED: release_grades'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if (select score from public.grades where assignment_id = (select v from t where k = 'memo')) <> 45 then raise exception 'FAILED: the released memo grade'; end if;
end $$;

-- 5. Cara, at the school but not in the class, sees nothing of it; as the school's admin she sees counts only.
select set_config('request.jwt.claims', json_build_object('sub', (select cara from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if exists (select 1 from public.assignments where community_id = (select v from t where k = 'class')) or exists (select 1 from public.grades where community_id = (select v from t where k = 'class'))
     or exists (select 1 from public.submissions where community_id = (select v from t where k = 'class')) or exists (select 1 from public.course_announcements where community_id = (select v from t where k = 'class')) then raise exception 'FAILED: someone outside the class saw it'; end if;
  begin perform public.school_courses('ucourse.edu'); raise exception 'FAILED: school_courses for a non-admin';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.forge_admins (uid) select cara from t_ids on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select cara from t_ids), 'role', 'authenticated')::text, true);
do $$ declare r record; begin
  select * into r from public.school_courses('ucourse.edu') where id = (select v from t where k = 'class');
  if r.assignments <> 2 or r.submissions < 2 or r.graded <> 3 or r.students <> 2 then raise exception 'FAILED: school_courses %', r; end if;
  if exists (select 1 from public.grades where community_id = (select v from t where k = 'class')) then raise exception 'FAILED: a school admin read a grade'; end if;
end $$;

reset role;
select 'courses tests: all passed';
rollback;
