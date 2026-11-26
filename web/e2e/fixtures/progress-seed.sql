-- Progress (e2e/zt-progress.cjs): a student (Maya) and a builder who isn't one (Cara), each with work
-- logged over the last few weeks. Maya's is verified by her club's officers and vouched for by a
-- professor; Cara's by a manager and a mentor, toward a goal. Triggers are paused so the rows can say
-- who verified them and when, as the app would have written them. Removed by progress-unseed.sql.
begin;
set local session_replication_role = replica;

insert into public.projects (id, owner_id, title, summary, tools, created_at, updated_at)
select 'e2e-prog-arm', id, 'Benchtop cobot arm', 'A six-axis arm for the robotics bench.', '{Python,"ROS 2",SolidWorks}'::text[], now() - interval '60 days', now()
  from auth.users where email = 'maya@forge.test'
union all
select 'e2e-prog-api', id, 'Check-in API', 'The backend for event check-in.', '{Go,Postgres,k6}'::text[], now() - interval '60 days', now()
  from auth.users where email = 'cara@forge.test'
on conflict (id) do nothing;

insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, evidence, status, reviewer_name, reviewer_role, reviewed_at, created_at)
select x.id, x.project, u.id, x.club, coalesce(c.name, ''), x.title, 'https://example.com/proof', x.status, x.reviewer, x.role,
       case when x.reviewed is null then null else now() - make_interval(days => x.reviewed) end, now() - make_interval(days => x.logged)
  from (values
    ('e2e-prog-m1', 'maya@forge.test', 'e2e-prog-arm', 'rob', 'Gripper picks 3 kg at ±0.05 mm', 'verified', 'Club officer', 'admin', 20, 18),
    ('e2e-prog-m2', 'maya@forge.test', 'e2e-prog-arm', 'rob', 'Cut the pick-and-place cycle to 7.1 s', 'verified', 'Club officer', 'owner', 9, 8),
    ('e2e-prog-m3', 'maya@forge.test', 'e2e-prog-arm', null, 'Trajectory planner passes 500 runs', 'verified', 'Prof. Dana Ruiz', 'professor', 6, 3),
    ('e2e-prog-m4', 'maya@forge.test', 'e2e-prog-arm', 'rob', 'Wrist camera calibrated', 'pending', '', '', 2, null),
    ('e2e-prog-c1', 'cara@forge.test', 'e2e-prog-api', null, 'p99 under 120 ms at 5k requests a second', 'verified', 'Sam Lee', 'manager', 12, 10),
    ('e2e-prog-c2', 'cara@forge.test', 'e2e-prog-api', null, 'Zero lost requests in a failover drill', 'verified', 'Ana Ruiz', 'mentor', 5, 4)
  ) as x(id, email, project, club, title, status, reviewer, role, logged, reviewed)
  join auth.users u on u.email = x.email
  left join public.communities c on c.id = x.club
on conflict (id) do nothing;

insert into public.member_goals (uid, kind, target, created_at)
select id, 'job', 'backend', now() - interval '11 days' from auth.users where email = 'cara@forge.test'
  and not exists (select 1 from public.member_goals g where g.uid = auth.users.id and g.status = 'active');

commit;
