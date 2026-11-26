-- Removes what progress-seed.sql added, so later journeys see the data they expect.
begin;
set local session_replication_role = replica;
delete from public.milestones where id like 'e2e-prog-%';
delete from public.projects where id like 'e2e-prog-%';
delete from public.member_goals where kind = 'job' and target = 'backend' and uid = (select id from auth.users where email = 'cara@forge.test');
commit;
