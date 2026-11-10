-- Seed data for the end-to-end tests (after the test members sign up): two clubs, follows,
-- Ben's projects with club-verified milestones (one on a private project), and a few posts.
create temp table u as select (select id from auth.users where email='josh@forge.test') josh, (select id from auth.users where email='maya@forge.test') maya, (select id from auth.users where email='ben@forge.test') ben, (select id from auth.users where email='cara@forge.test') cara;
update public.profiles set onboarded = true, field = 'Aerospace Engineering', interests = '{Rocketry,Robotics}';
update public.profiles set headline = 'Propulsion lead, Rocketry Club', bio = 'I build liquid engines and the test stands that keep them honest.', open_to = '{internships,research}', location = 'Boston, MA', links = '[{"label":"GitHub","url":"https://github.com/bencho"},{"url":"https://bencho.dev"}]' where id = (select ben from u);
update public.profiles set headline = 'Avionics, flight software' where id = (select maya from u);
insert into public.communities (id, name, type, privacy, owner_id, about, topics) select 'rkt', 'Rocketry Club', 'project', 'public', ben, 'We design, build and fly high-power rockets.', '{Rocketry}' from u;
insert into public.communities (id, name, type, privacy, owner_id, about) select 'rob', 'Robotics Society', 'project', 'public', maya, 'Autonomous robots and competitions.' from u;
insert into public.community_members (community_id, uid, role) select 'rkt', ben, 'owner' from u union all select 'rkt', josh, 'member' from u union all select 'rkt', maya, 'admin' from u union all select 'rob', maya, 'owner' from u union all select 'rob', ben, 'member' from u;
insert into public.follows (follower, target) select josh, maya from u union all select maya, ben from u union all select cara, ben from u union all select josh, cara from u;
insert into public.projects (id, owner_id, title, summary, status, year, tags, tools) select 'p1', ben, 'Liquid engine test stand', 'A load-cell instrumented stand for static fires up to 2 kN.', 'in_progress', null, '{Rocketry}', '{SolidWorks,Load cell,LabVIEW,Python,Welding}' from u;
insert into public.projects (id, owner_id, title, summary, status, year, tags, tools) select 'p2', ben, 'Recovery avionics', 'Dual-deploy flight computer on an STM32.', 'completed', 2026, '{Rocketry}', '{STM32,C,KiCad,IMU}' from u;
insert into public.projects (id, owner_id, title, summary, private, tags) select 'p3', ben, 'Stealth side project', 'Not public yet.', true, '{}' from u;
alter table public.milestones disable trigger user;
insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, detail, achieved_on, status, reviewer_name, reviewed_at) select 'm1', 'p1', ben, 'rkt', 'Rocketry Club', 'Static fire at 1.2 kN', 'Thrust curve within 3% of simulation.', current_date - 10, 'verified', 'Maya Patel', now() - interval '9 days' from u
 union all select 'm2', 'p2', ben, 'rob', 'Robotics Society', 'Flight computer passed vibration test', '', current_date - 40, 'verified', 'Maya Patel', now() - interval '39 days' from u
 union all select 'm3', 'p3', ben, 'rkt', 'Rocketry Club', 'Private milestone', '', current_date - 2, 'verified', 'Maya Patel', now() - interval '1 days' from u;
alter table public.milestones enable trigger user;
insert into public.posts (author_id, body, kind, tags, created_at) select ben, 'Static fire #3 done. 1.2 kN peak, clean shutdown.', 'result', '{Rocketry}'::text[], now() - interval '9 days' from u
 union all select maya, 'Anyone tried Kalman filtering on a cheap IMU? Looking for tips.', 'question', '{Robotics}'::text[], now() - interval '3 hours' from u
 union all select cara, 'Hello Forge!', 'update', '{}'::text[], now() - interval '1 day' from u;
insert into public.posts (author_id, body, kind, community_id, created_at) select ben, 'Launch day is Saturday. Who is driving?', 'update', 'rkt', now() - interval '5 hours' from u;
-- A verified company (Cara is its admin) for Find builders; Ben made two verified milestones public.
insert into public.organizations (type, name, domain) values ('company', 'Acme Aerospace', 'forge.test');
insert into public.organization_admins (org_id, uid) select id, (select cara from u) from public.organizations where domain = 'forge.test';
update public.milestones set private = false where id in ('m1', 'm2');
-- Maya is a Forge admin (approves sponsorship pilots on /admin).
insert into public.forge_admins (uid) select maya from u;
