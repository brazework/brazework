-- Brazework Demo University (e2e/demo-university.sh): the school, its people and a capstone course
-- mid-semester. Run with psql -v domain=<the demo domain>. Made-up people and work. Safe to run again:
-- the demo class and club are rebuilt each time.
select set_config('demo.domain', :'domain', false);

do $$
declare
  d text := current_setting('demo.domain');
  dean uuid; prof uuid; ta uuid; ava uuid; ben uuid; cleo uuid; dev uuid; eli uuid; fay uuid;
  org text; c text; club text; m1 text; m2 text; m3 text; a1 text; a2 text; a3 text; p1 text; p2 text; s1 text; s2 text; s3 text;
begin
  select id into dean from auth.users where email = 'dean@' || d;
  select id into prof from auth.users where email = 'prof@' || d;
  select id into ta from auth.users where email = 'ta@' || d;
  select id into ava from auth.users where email = 'ava@' || d;
  select id into ben from auth.users where email = 'ben@' || d;
  select id into cleo from auth.users where email = 'cleo@' || d;
  select id into dev from auth.users where email = 'dev@' || d;
  select id into eli from auth.users where email = 'eli@' || d;
  select id into fay from auth.users where email = 'fay@' || d;
  if prof is null or fay is null then raise exception 'The demo people haven''t signed up. Run e2e/demo-university.sh.'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where email like '%@' || d;

  -- Profiles, finished.
  update public.profiles set onboarded = true, field = 'Mechanical Engineering', headline = 'Capstone · ' || case id
    when ava then 'Senior, controls lead' when ben then 'Senior, mechanical design' when cleo then 'Senior, test and data'
    when dev then 'Senior, electronics' when eli then 'Senior, manufacturing' when fay then 'Senior, systems' else 'Faculty' end
   where id in (ava, ben, cleo, dev, eli, fay, prof, ta);
  update public.profiles set onboarded = true, headline = 'Associate Dean, Engineering' where id = dean;

  -- The school, official, with the dean as its admin; the professor and TA on its faculty list.
  insert into public.organizations (type, name, domain, official, verification_status, created_by)
  values ('school', 'Brazework Demo University', d, true, 'verified', dean)
  on conflict (domain) do update set name = excluded.name, official = true, verification_status = 'verified'
  returning id into org;
  insert into public.organization_admins (org_id, uid) values (org, dean) on conflict do nothing;
  insert into public.school_faculty (domain, email, name, title) values
    (d, 'prof@' || d, 'Elena Ruiz', 'Associate Professor'), (d, 'ta@' || d, 'Sam Okafor', 'Teaching Assistant')
  on conflict do nothing;

  -- Rebuild the demo class and club.
  delete from public.communities where school_domain = d and type = 'class' and course = 'ME 410';
  delete from public.communities where name = 'Demo University Robotics';

  insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name, school_domain, course, term)
  values ('ME 410 · Capstone Design', 'Senior capstone: one sponsored project per team, start to finish.', '', 'class', 'approval', '{}', '', prof, 'Elena Ruiz', d, 'ME 410', 'Fall 2026')
  returning id into c;
  insert into public.community_members (community_id, uid, role) values (c, prof, 'owner'), (c, ta, 'moderator'),
    (c, ava, 'member'), (c, ben, 'member'), (c, cleo, 'member'), (c, dev, 'member'), (c, eli, 'member'), (c, fay, 'member')
  on conflict do nothing;
  insert into public.class_roster (community_id, email) select c, email from auth.users where id in (ava, ben, cleo, dev, eli, fay) on conflict do nothing;

  -- Two teams, each a class project with verified work.
  insert into public.projects (owner_id, title, summary, status, community_id, private) values
    (ava, 'Autonomous greenhouse vent', 'A solar-powered vent that holds a greenhouse within 2 °C, sponsored by a local grower.', 'in_progress', c, false) returning id into p1;
  insert into public.projects (owner_id, title, summary, status, community_id, private) values
    (dev, 'Wheelchair stair-climber', 'A tri-star wheel attachment that climbs a standard stair at 0.2 m/s.', 'in_progress', c, false) returning id into p2;
  insert into public.project_members (project_id, uid) values (p1, ben), (p1, cleo), (p2, eli), (p2, fay) on conflict do nothing;
  alter table public.milestones disable trigger user;
  insert into public.milestones (project_id, owner_id, community_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, reviewer_role, reviewed_at, private, shared_at) values
    (p1, ava, c, 'ME 410 · Capstone Design', 'Held 24 ± 2 °C for 72 hours in the sponsor''s greenhouse', 'Logged every minute; worst excursion 1.6 °C.', 'https://example.com/greenhouse-log', current_date - 9, 'verified', 'Elena Ruiz', 'faculty', now() - interval '8 days', false, now() - interval '8 days'),
    (p1, ben, c, 'ME 410 · Capstone Design', 'Vent linkage passed 10,000 open-close cycles', 'No wear past 0.1 mm on the pivot bushings.', 'https://example.com/cycle-test', current_date - 4, 'verified', 'Sam Okafor', 'faculty', now() - interval '3 days', false, now() - interval '3 days'),
    (p2, dev, c, 'ME 410 · Capstone Design', 'Climbed 12 stairs with an 80 kg load', 'Video and motor current traces attached.', 'https://example.com/stair-video', current_date - 2, 'pending', '', '', null, false, now() - interval '2 days');
  alter table public.milestones enable trigger user;

  -- The course: three modules, a rubric assignment (ABET-tagged), and a group design review with peer
  -- evaluation.
  insert into public.course_modules (community_id, title, position, published) values (c, 'Weeks 1–3 · Requirements', 0, true) returning id into m1;
  insert into public.course_modules (community_id, title, position, published) values (c, 'Weeks 4–7 · Concept and design review', 1, true) returning id into m2;
  insert into public.course_modules (community_id, title, position, published) values (c, 'Weeks 8–12 · Build and test', 2, false) returning id into m3;
  insert into public.course_items (module_id, community_id, kind, title, body, url, position) values
    (m1, c, 'page', 'How this course runs', E'Each team runs one sponsored project from requirements to a tested prototype.\n\nLog milestones with their proof on your project; we verify them as we grade, and they go on your record with ME 410.', null, 0),
    (m1, c, 'link', 'Requirements template (Onshape)', '', 'https://cad.onshape.com/documents/requirements-template', 1),
    (m2, c, 'link', 'Design review checklist', '', 'https://docs.google.com/document/d/design-review-checklist', 0);
  insert into public.assignments (community_id, module_id, title, instructions, due_at, submit_as, rubric, published) values
    (c, m1, 'Requirements memo', 'Interview your sponsor and turn what you hear into ranked, testable requirements.', now() - interval '20 days', '{file,link,milestone}',
     '[{"id":"r1","criterion":"Customer needs, captured and ranked","points":20,"outcome":"2"},{"id":"r2","criterion":"Requirements are testable","points":20,"outcome":"1"},{"id":"r3","criterion":"Writing","points":10,"outcome":"3"}]', true)
    returning id into a1;
  insert into public.assignments (community_id, module_id, title, instructions, due_at, submit_as, rubric, group_work, peer_eval, published) values
    (c, m2, 'Design review', 'Present your concept, analysis and risk list. One hand-in per team; rate your teammates after.', now() - interval '3 days', '{link,milestone}',
     '[{"id":"r1","criterion":"Analysis","points":40,"outcome":"1"},{"id":"r2","criterion":"Design meets the requirements","points":40,"outcome":"2"},{"id":"r3","criterion":"Teamwork","points":20,"outcome":"5"}]', true, true, true)
    returning id into a2;
  insert into public.assignments (community_id, module_id, title, instructions, due_at, submit_as, published) values
    (c, m3, 'Test plan', 'What you''ll test, how, and what passing looks like.', now() + interval '6 days', '{file,link}', true)
    returning id into a3;

  -- Hand-ins and released grades on the memo (rubric scores, so the ABET outcomes fill in).
  insert into public.submissions (assignment_id, community_id, uid, url, submitted_at) values
    (a1, c, ava, 'https://docs.google.com/document/d/ava-memo', now() - interval '21 days'),
    (a1, c, ben, 'https://docs.google.com/document/d/ben-memo', now() - interval '21 days'),
    (a1, c, cleo, 'https://docs.google.com/document/d/cleo-memo', now() - interval '20 days' + interval '3 hours'),
    (a1, c, dev, 'https://docs.google.com/document/d/dev-memo', now() - interval '22 days'),
    (a1, c, eli, 'https://docs.google.com/document/d/eli-memo', now() - interval '21 days'),
    (a1, c, fay, 'https://docs.google.com/document/d/fay-memo', now() - interval '21 days');
  insert into public.grades (assignment_id, uid, community_id, score, rubric_scores, feedback, graded_by, released, released_at) values
    (a1, ava, c, 47, '{"r1":19,"r2":19,"r3":9}', 'Sharp ranking; the sponsor quotes make it.', prof, true, now() - interval '15 days'),
    (a1, ben, c, 41, '{"r1":17,"r2":16,"r3":8}', 'Two requirements aren''t testable as written.', prof, true, now() - interval '15 days'),
    (a1, cleo, c, 38, '{"r1":15,"r2":15,"r3":8}', 'Late by three hours; good test thinking.', ta, true, now() - interval '15 days'),
    (a1, dev, c, 44, '{"r1":18,"r2":18,"r3":8}', 'Clear and measurable.', prof, true, now() - interval '15 days'),
    (a1, eli, c, 33, '{"r1":12,"r2":13,"r3":8}', 'Talk to the end user, not only the sponsor.', ta, true, now() - interval '15 days'),
    (a1, fay, c, 45, '{"r1":18,"r2":18,"r3":9}', 'Excellent traceability.', prof, true, now() - interval '15 days')
  on conflict do nothing;
  -- The design review: both teams handed in; one graded and released, one waiting.
  insert into public.submissions (assignment_id, community_id, uid, project_id, url, submitted_at) values
    (a2, c, ava, p1, 'https://youtu.be/greenhouse-review', now() - interval '4 days'),
    (a2, c, dev, p2, 'https://youtu.be/stair-climber-review', now() - interval '3 days' + interval '1 hour');
  insert into public.grades (assignment_id, uid, community_id, score, rubric_scores, feedback, graded_by, released, released_at)
  select a2, u, c, 88, '{"r1":35,"r2":36,"r3":17}', 'Strong analysis; tighten the risk list.', prof, true, now() - interval '1 day' from unnest(array[ava, ben, cleo]) u
  on conflict do nothing;
  insert into public.peer_reviews (assignment_id, reviewer, reviewee, community_id, score, comment) values
    (a2, ava, ben, c, 5, 'Ran the cycle test rig.'), (a2, ava, cleo, c, 4, ''), (a2, ben, ava, c, 5, 'Kept us on schedule.'),
    (a2, ben, cleo, c, 4, ''), (a2, cleo, ava, c, 5, ''), (a2, cleo, ben, c, 3, 'Missed one build session.'),
    (a2, dev, eli, c, 4, ''), (a2, dev, fay, c, 5, 'Did the whole power budget.'), (a2, eli, dev, c, 4, ''), (a2, fay, dev, c, 5, '')
  on conflict do nothing;

  -- Eli has an accommodation (quizzes and attendance were taken out, 2026-11-27: the LMS runs them).
  insert into public.course_accommodations (community_id, uid, extra_days, extra_time_pct, note, set_by) values (c, eli, 2, 50, 'From accessibility services', prof) on conflict do nothing;

  insert into public.course_announcements (community_id, author_id, title, body, created_at) values
    (c, prof, 'Design reviews are graded', E'Grades and comments are out for the greenhouse team.\n\nStair-climber team: yours this week.', now() - interval '1 day'),
    (c, ta, 'Machine shop hours this week', 'Tuesday and Thursday, 2 to 6 pm. Book a slot in the sign-up sheet.', now() - interval '5 days');

  -- A club on campus, with an officer.
  insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name, school_domain)
  values ('Demo University Robotics', 'We build a competition robot every year.', 'Robotics & Autonomy', 'field', 'public', '{Robotics & Autonomy}', '', fay, 'Fay Nguyen', d)
  returning id into club;
  insert into public.community_members (community_id, uid, role) values (club, fay, 'owner'), (club, dev, 'member'), (club, ava, 'member') on conflict do nothing;
end $$;
