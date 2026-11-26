-- Brazework Courses, phase B (courses-b.sql): quizzes with hidden keys and automatic marking,
-- extensions and accommodations, attendance with check-in codes, peer evaluation, and ABET outcome
-- attainment as aggregates. Run inside a transaction and rolled back. Uses the seeded test members.
begin;
create temp table t_ids as
  select (select id from auth.users where email = 'ben@forge.test') ben,
         (select id from auth.users where email = 'maya@forge.test') maya,
         (select id from auth.users where email = 'cara@forge.test') cara,
         (select id from auth.users where email = 'josh@forge.test') josh;
grant select on t_ids to authenticated;
create temp table t (k text primary key, v text);
grant all on t to authenticated;

-- Maya teaches at ubee.edu; Ben, Josh and Cara are her students.
update auth.users set email = 'maya@ubee.edu', email_confirmed_at = now() where id = (select maya from t_ids);
update auth.users set email = 'ben@ubee.edu', email_confirmed_at = now() where id = (select ben from t_ids);
update auth.users set email = 'josh@ubee.edu', email_confirmed_at = now() where id = (select josh from t_ids);
update auth.users set email = 'cara@ubee.edu', email_confirmed_at = now() where id = (select cara from t_ids);
insert into public.school_faculty (domain, email, name) values ('ubee.edu', 'maya@ubee.edu', 'Maya Ortiz') on conflict do nothing;
-- Maya starts as faculty only (the seed makes her a Brazework admin; that comes back in step 5).
delete from public.forge_admins where uid = (select maya from t_ids);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ declare c text; q text; begin
  c := public.create_class('ME 320', 'Dynamics', 'Fall 2026');
  perform public.set_class_roster(c, array['ben@ubee.edu', 'josh@ubee.edu', 'cara@ubee.edu']);
  insert into t values ('class', c);
  -- 1. A quiz: the answers go to quiz_keys, the questions stay without them.
  insert into public.assignments (community_id, title, due_at, published) values (c, 'Quiz 1', now() + interval '2 days', false) returning id into q;
  insert into t values ('quiz', q);
  if public.set_quiz(q, '[
    {"id":"a","prompt":"Units of force?","type":"choice","options":["J","N","W"],"answer":1,"points":2},
    {"id":"b","prompt":"Which are vectors?","type":"multi","options":["mass","velocity","force","energy"],"answer":[1,2],"points":3},
    {"id":"c","prompt":"g in m/s^2?","type":"number","answer":9.81,"tolerance":0.05,"points":5},
    {"id":"d","prompt":"Explain inertia.","type":"short","points":10}]') <> 4 then raise exception 'FAILED: set_quiz'; end if;
  if (select points from public.assignments where id = q) <> 20 then raise exception 'FAILED: the quiz is worth its questions'' points'; end if;
  if (select quiz::text from public.assignments where id = q) like '%answer%' then raise exception 'FAILED: answers left in the questions'; end if;
  begin perform public.set_quiz(q, '[{"id":"x","prompt":"?","type":"choice","options":["a","b"],"points":1}]'); raise exception 'FAILED: a choice question with no right option';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  update public.assignments set published = true where id = q;
end $$;

-- Students can't read the key, and can't hand a quiz in like an assignment.
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ declare q text := (select v from t where k = 'quiz'); s numeric; begin
  if exists (select 1 from public.quiz_keys) then raise exception 'FAILED: a student read a quiz key'; end if;
  begin perform public.submit_assignment(q, 'my answers'); raise exception 'FAILED: a quiz handed in as an assignment';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  -- Ben: a right, b right (order doesn't matter), c within tolerance, d short. Short answers wait, so no score yet.
  s := public.submit_quiz(q, '{"a":1,"b":[2,1],"c":9.8,"d":"It keeps moving."}');
  if s is not null then raise exception 'FAILED: a score shown before the short answer is graded'; end if;
  begin perform public.submit_quiz(q, '{"a":1}'); raise exception 'FAILED: took the quiz twice';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if (select score from public.grades where assignment_id = (select v from t where k = 'quiz') and uid = (select ben from t_ids)) <> 10 then
    raise exception 'FAILED: automatic marking (expected 10 of the 10 auto-marked points)';
  end if;
end $$;

-- 3. Extensions and accommodations: Josh's quiz is due later; Cara gets 3 extra days on everything.
do $$ declare q text := (select v from t where k = 'quiz'); begin
  perform public.set_extension(q, (select josh from t_ids), now() + interval '10 days');
  perform public.set_accommodation((select v from t where k = 'class'), (select cara from t_ids), 3, 50, 'Extended time');
  if public.due_for(q, (select josh from t_ids)) < now() + interval '9 days' then raise exception 'FAILED: the extension'; end if;
  if public.due_for(q, (select cara from t_ids)) < now() + interval '4 days' then raise exception 'FAILED: the accommodation'; end if;
  -- The quiz closes for Ben (due passed) but not for Josh.
  update public.assignments set due_at = now() - interval '1 hour' where id = q;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select josh from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from public.assignment_extensions) <> 1 then raise exception 'FAILED: Josh should see his own extension'; end if;
  if exists (select 1 from public.course_accommodations) then raise exception 'FAILED: Josh saw Cara''s accommodation'; end if;
  if public.submit_quiz((select v from t where k = 'quiz'), '{"a":0,"b":[1],"c":3}') is not null then raise exception 'FAILED: hidden until the short answer is graded'; end if;
  if (select due_at from public.my_due() where id = (select v from t where k = 'quiz')) < now() + interval '9 days' then raise exception 'FAILED: my_due uses the extension'; end if;
end $$;

-- 2. Attendance: the code is the staff's; a student checks in with it; staff mark the rest.
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ declare sid text; begin
  sid := public.open_session((select v from t where k = 'class'), 'Lecture 1', 15);
  insert into t values ('session', sid), ('code', (select code from public.course_session_codes((select v from t where k = 'class')) where id = sid));
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.course_session_codes((select v from t where k = 'class')); raise exception 'FAILED: a student read the codes';
  exception when insufficient_privilege then null; end;
  begin perform public.check_in('ZZZZZZ'); raise exception 'FAILED: a wrong code checked in';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  if public.check_in(lower((select v from t where k = 'code'))) <> 'ME 320 · Dynamics' then raise exception 'FAILED: check_in'; end if;
  if (select status from public.attendance where session_id = (select v from t where k = 'session')) <> 'present' then raise exception 'FAILED: Ben present'; end if;
  if (select count(*) from public.course_sessions where community_id = (select v from t where k = 'class')) <> 1 then raise exception 'FAILED: students see sessions'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  perform public.mark_attendance((select v from t where k = 'session'), (select cara from t_ids), 'excused');
  perform public.close_session((select v from t where k = 'session'));
  if (select count(*) from public.attendance where session_id = (select v from t where k = 'session')) <> 2 then raise exception 'FAILED: staff see attendance'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select josh from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.check_in((select v from t where k = 'code')); raise exception 'FAILED: checked in after it closed';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
  if exists (select 1 from public.attendance) then raise exception 'FAILED: Josh saw others'' attendance'; end if;
end $$;

-- 4. Peer evaluation: Ben and Josh share a project; Ben rates Josh; Cara can't rate Josh.
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ declare g text; begin
  insert into public.assignments (community_id, title, group_work, peer_eval, submit_as, published, points) values ((select v from t where k = 'class'), 'Design review', true, true, '{link}', true, 100) returning id into g;
  insert into t values ('review', g);
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ declare p text; begin
  insert into public.projects (title, summary, community_id, private) values ('Pendulum rig', 'A double pendulum for ME 320.', (select v from t where k = 'class'), true) returning id into p;
  insert into t values ('project', p);
end $$;
reset role;
insert into public.project_members (project_id, uid) select (select v from t where k = 'project'), josh from t_ids on conflict do nothing;
set local role authenticated;
do $$ begin
  if (select count(*) from public.my_teammates((select v from t where k = 'review'))) <> 1 then raise exception 'FAILED: my_teammates'; end if;
  perform public.submit_peer_review((select v from t where k = 'review'), (select josh from t_ids), 5, 'Carried the CAD.');
  perform public.submit_peer_review((select v from t where k = 'review'), (select josh from t_ids), 4, 'Carried the CAD, late once.');
  if (select score from public.peer_reviews) <> 4 then raise exception 'FAILED: a rating can be changed'; end if;
  begin perform public.submit_peer_review((select v from t where k = 'review'), (select ben from t_ids), 5); raise exception 'FAILED: rated himself';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select josh from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if exists (select 1 from public.peer_reviews) then raise exception 'FAILED: Josh saw who rated him'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select cara from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.submit_peer_review((select v from t where k = 'review'), (select josh from t_ids), 1); raise exception 'FAILED: rated someone not on her project';
  exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end;
end $$;

-- 5. ABET outcomes: three students graded on a row tagged outcome 2; the course and the school see
-- attainment, never a name.
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ declare a text; r record; begin
  insert into public.assignments (community_id, title, published, rubric) values ((select v from t where k = 'class'), 'Lab report', true,
    '[{"id":"r1","criterion":"Design","points":10,"outcome":"2"},{"id":"r2","criterion":"Writing","points":10}]') returning id into a;
  perform public.grade_students(a, array[(select ben from t_ids)], null, '{"r1": 9, "r2": 8}', '', true);
  perform public.grade_students(a, array[(select josh from t_ids)], null, '{"r1": 6, "r2": 8}', '', true);
  perform public.grade_students(a, array[(select cara from t_ids)], null, '{"r1": 8, "r2": 8}', '', true);
  select * into r from public.course_outcomes((select v from t where k = 'class'));
  if r.outcome <> '2' or r.students <> 3 or r.average <> 76.7 or r.meeting <> 66.7 then raise exception 'FAILED: course_outcomes %', r; end if;
  begin perform public.school_outcomes('ubee.edu'); raise exception 'FAILED: faculty saw the school''s outcomes';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.forge_admins (uid) select maya from t_ids on conflict do nothing;
set local role authenticated;
do $$ declare r record; begin
  select * into r from public.school_outcomes('ubee.edu');
  if r.outcome <> '2' or r.students <> 3 or r.course <> 'ME 320 · Dynamics' then raise exception 'FAILED: school_outcomes %', r; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.course_outcomes((select v from t where k = 'class')); raise exception 'FAILED: a student saw course outcomes';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'courses-b tests: all passed';
rollback;
