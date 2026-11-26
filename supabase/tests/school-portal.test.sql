-- The school portal (school-portal.sql): faculty lists, classes, rosters, class projects, the school's
-- view. Run inside a transaction and rolled back. Uses the seeded test members (ben, maya, cara).
begin;
create temp table t_ids as
  select (select id from auth.users where email = 'ben@forge.test') ben,
         (select id from auth.users where email = 'maya@forge.test') maya,
         (select id from auth.users where email = 'cara@forge.test') cara;
grant select on t_ids to authenticated;

-- Maya is a professor at uportal.edu; Ben a student there; Cara is not at the school.
update auth.users set email = 'maya@uportal.edu', email_confirmed_at = now() where id = (select maya from t_ids);
update auth.users set email = 'ben@uportal.edu', email_confirmed_at = now() where id = (select ben from t_ids);

do $$ begin
  -- 1. The domain was grouped as soon as a confirmed student used it.
  if not exists (select 1 from public.school_domains where domain = 'uportal.edu') then raise exception 'FAILED: an unregistered university domain is not grouped'; end if;
end $$;

-- The school's admin (a Brazework admin until the school has its own) lists Maya as faculty.
insert into public.forge_admins (uid) select cara from t_ids on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select cara from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if public.add_faculty('uportal.edu', '[{"email":"maya@uportal.edu","name":"Maya Ortiz","title":"Professor"},{"email":"someone@gmail.com"}]') <> 1 then
    raise exception 'FAILED: add_faculty should take only emails at the school';
  end if;
end $$;

-- 2. Ben (a student, not faculty) can't start a class; create_community can't make one either.
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.create_class('ME 410', 'Capstone Design', 'Fall 2026'); raise exception 'FAILED: a student started a class';
  exception when insufficient_privilege then null; end;
  begin perform public.create_community('Fake class', '', '', 'class', 'public', '{}', ''); raise exception 'FAILED: create_community made a class';
  exception when insufficient_privilege then null; end;
end $$;

-- 3. Maya starts a class and sets its roster; Ben is on it and joins at once.
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
create temp table t_class (id text);
grant all on t_class to authenticated;
insert into t_class select public.create_class('me 410', 'Capstone Design', 'Fall 2026');
do $$ declare c text := (select id from t_class); begin
  if (select type || '|' || privacy || '|' || course from public.communities where id = c) <> 'class|approval|ME 410' then raise exception 'FAILED: the class is not a private class'; end if;
  if public.set_class_roster(c, array['BEN@uportal.edu', 'new.student@uportal.edu', 'not an email']) <> 2 then raise exception 'FAILED: roster count'; end if;
  if not exists (select 1 from public.community_members where community_id = c and uid = (select ben from t_ids) and role = 'member') then raise exception 'FAILED: Ben did not join from the roster'; end if;
  -- A club owner can't turn the class into a club.
  begin update public.communities set type = 'field' where id = c; raise exception 'FAILED: the class became a club';
  exception when insufficient_privilege then null; end;
end $$;

-- 4. Ben starts a class project and asks the class to verify a milestone; Maya verifies it.
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
create temp table t_m (pid text, mid text);
grant all on t_m to authenticated;
do $$ declare c text := (select id from t_class); p text; m text; begin
  insert into public.projects (title, summary, community_id, private) values ('Planetary gearbox', 'A 5:1 planetary reduction for ME 410.', c, true) returning id into p;
  insert into public.milestones (project_id, community_id, title, evidence) values (p, c, 'Ran 2 hours at 40 N·m', 'https://example.com/dyno') returning id into m;
  insert into t_m values (p, m);
  if (select count(*) from public.my_classes()) <> 1 then raise exception 'FAILED: my_classes'; end if;
  begin perform public.set_class_roster(c, array['x@uportal.edu']); raise exception 'FAILED: a student changed the roster';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select maya from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if public.review_milestone((select mid from t_m), true, 'Saw the dyno run.') <> 'verified' then raise exception 'FAILED: faculty could not verify'; end if;
end $$;

-- 5. The school's view: only for the school's admins (not a student), and it counts the verified class work.
select set_config('request.jwt.claims', json_build_object('sub', (select ben from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.school_overview('uportal.edu'); raise exception 'FAILED: a student saw the school view';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select cara from t_ids), 'role', 'authenticated')::text, true);
do $$ declare o jsonb := public.school_overview('uportal.edu'); begin
  if (o->>'classes')::int <> 1 or (o->>'verified_in_classes')::int <> 1 or (o->>'faculty')::int <> 1 or (o->>'students')::int < 2 then
    raise exception 'FAILED: school_overview %', o;
  end if;
  if (select count(*) from public.school_evidence('uportal.edu')) <> 1 then raise exception 'FAILED: school_evidence'; end if;
  if (select setting || '|' || term from public.school_evidence('uportal.edu')) <> 'ME 410 · Capstone Design|Fall 2026' then raise exception 'FAILED: evidence row'; end if;
end $$;

-- 6. Someone who signs up later with a rostered email joins when they open Your school.
reset role;
update auth.users set email = 'new.student@uportal.edu', email_confirmed_at = now() where id = (select cara from t_ids);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select cara from t_ids), 'role', 'authenticated')::text, true);
do $$ begin
  if public.sync_my_classes() <> 1 then raise exception 'FAILED: sync_my_classes'; end if;
end $$;

reset role;
select 'school-portal tests: all passed';
rollback;
