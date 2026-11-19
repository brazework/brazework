-- Demo data for the launch video (e2e/demo.sh, local only). Made-up people and work. Safe to run again.
create temp table d as select
  (select id from auth.users where email = 'priya@forge.test') priya,
  (select id from auth.users where email = 'leo@forge.test') leo,
  (select id from auth.users where email = 'ana@forge.test') ana,
  (select id from auth.users where email = 'maya@forge.test') maya;

update public.profiles set onboarded = true, field = 'Data & AI', interests = '{Machine Learning,Computer Vision,Data Engineering}',
  headline = 'CS + Biology, junior · ML for crop disease', bio = 'I train small models that run on a farmer''s phone.' where id = (select priya from d);
update public.profiles set onboarded = true, field = 'Design & Arts', interests = '{Product & UX Design,Graphic Design,Film & Video}',
  headline = 'Industrial design, senior · Rocketry Club', bio = 'I design things people hold, and the rockets the club flies.' where id = (select leo from d);
update public.profiles set onboarded = true, field = 'Computer Science', interests = '{Software Engineering,Distributed Systems,Human-Computer Interaction}',
  headline = 'Backend engineer · building on my own', bio = 'I ship small, fast tools for clinics.' where id = (select ana from d);

insert into public.community_members (community_id, uid, role) select 'rkt', leo, 'member' from d on conflict do nothing;

insert into public.projects (id, owner_id, title, summary, status, tags, private) values
  ('demo-p1', (select priya from d), 'Crop disease classifier', 'A 4 MB model that spots leaf blight from a phone photo, offline.', 'in_progress', '{Machine Learning}', false),
  ('demo-p2', (select leo from d), 'Fin can for the spring launch', 'A printed fin can with swept fins, tested in the wind tunnel.', 'completed', '{Rocketry}', false),
  ('demo-p3', (select ana from d), 'Clinic check-in kiosk', 'A tablet check-in that cut the front-desk line from 12 to 4 minutes.', 'in_progress', '{Health Tech}', false)
on conflict (id) do nothing;

alter table public.milestones disable trigger user;
insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, reviewer_role, reviewed_at, vouched_by, private, shared_at) values
  ('demo-m1', 'demo-p1', (select priya from d), null, '', '94.1% on 1,200 field-trial photos, +3.1 over the baseline', 'Held-out photos from three farms; same split as the baseline.', 'https://example.com/wandb-run', current_date - 6, 'verified', '', '', now() - interval '5 days', 'Dr. Elena Ruiz, Assistant Professor · stateu.edu', false, now() - interval '5 days'),
  ('demo-m2', 'demo-p1', (select priya from d), null, '', 'Model runs offline on a $90 Android phone in 180 ms', '', 'https://example.com/benchmark', current_date - 1, 'pending', '', '', null, '', false, now() - interval '1 day'),
  ('demo-m3', 'demo-p2', (select leo from d), 'rkt', 'Rocketry Club', 'Fin can survived Mach 0.8 in the wind tunnel, no flutter', 'Three runs; strain gauges under 40% of yield.', 'https://example.com/tunnel-video', current_date - 12, 'verified', 'Maya Patel', 'officer', now() - interval '11 days', '', false, now() - interval '11 days'),
  ('demo-m4', 'demo-p3', (select ana from d), null, '', 'Check-in line down from 12 to 4 minutes at the pilot clinic', 'Two weeks of timestamps before and after.', 'https://example.com/report', current_date - 9, 'verified', '', '', now() - interval '8 days', 'Sam Okafor, Operations Manager · northclinic.org', false, now() - interval '8 days')
on conflict (id) do nothing;
alter table public.milestones enable trigger user;
insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash)
select 'demo-m2', priya, 'e.ruiz@stateu.edu', 'professor', repeat('9', 64) from d
where not exists (select 1 from public.milestone_vouches where milestone_id = 'demo-m2');

-- What the demo films needs to have something to act on (the MCP dry run, Nov 19): Priya in a club,
-- upcoming events to RSVP to (including a company's intern session for /career_fair), and a recruiter's
-- message request in her inbox to reply to.
insert into public.community_members (community_id, uid, role) select 'rob', priya, 'member' from d on conflict do nothing;

insert into public.events (id, community_id, org_id, title, description, type, format, location, topic, starts_at, ends_at, status, created_by) values
  ('demo-e1', 'rob', null, 'Field robot build night', 'Bring your sensors: we''re mounting the crop camera on the field robot.', 'Workshop', 'In person', 'Engineering Lab 204', 'Robotics',
     date_trunc('day', now()) + interval '2 days 18 hours', date_trunc('day', now()) + interval '2 days 21 hours', 'published', (select maya from d)),
  ('demo-e2', 'rkt', null, 'Spring launch: fin can test flight', 'Launch day at the county field. Range safety briefing at 9.', 'Workshop', 'In person', 'County launch field', 'Rocketry',
     date_trunc('day', now()) + interval '9 days 9 hours', date_trunc('day', now()) + interval '9 days 15 hours', 'published', (select maya from d))
on conflict (id) do nothing;
insert into public.events (id, community_id, org_id, title, description, type, format, location, topic, starts_at, ends_at, status, created_by)
select 'demo-e3', null, o.id, 'Acme Aerospace intern info session', 'Meet the team hiring summer interns in avionics and ML. Bring a link to your signed work.', 'Career fair', 'Hybrid', 'Student Center, Room B', 'Careers',
       date_trunc('day', now()) + interval '5 days 17 hours', date_trunc('day', now()) + interval '5 days 19 hours', 'published', (select maya from d)
  from public.organizations o where o.name = 'Acme Aerospace' and o.type = 'company'
on conflict (id) do nothing;

-- Cara (Acme Aerospace) asks Priya to talk: a message request, started the way the app starts one.
do $$
declare cara uuid := (select id from auth.users where email = 'cara@forge.test');
        priya uuid := (select id from auth.users where email = 'priya@forge.test');
        c text;
begin
  if cara is null or priya is null then return; end if;
  perform set_config('request.jwt.claim.sub', cara::text, true);
  c := public.start_conversation(priya);
  if not exists (select 1 from public.messages where conversation_id = c) then
    insert into public.messages (conversation_id, sender_id, body)
    values (c, cara, 'Hi Priya, I lead ML interns at Acme Aerospace. Your crop classifier on a $90 phone caught my eye. Open to a 15-minute call about our summer roles?');
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
