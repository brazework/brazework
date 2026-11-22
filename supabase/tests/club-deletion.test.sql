\set QUIET on
begin;
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('request.jwt.claim.sub', :'ben', true);

insert into public.milestones (id, project_id, community_id, title, evidence)
values ('club-delete-pending', 'p1', 'rkt', 'Check the test stand.', 'https://example.com/test'),
       ('club-delete-dispute', 'p1', 'rkt', 'Check the fixture.', 'https://example.com/fixture');
update public.milestones set status = 'disputed', dispute_note = 'Review requested.' where id = 'club-delete-dispute';
insert into public.posts (id, community_id, author_id, body)
values ('club-delete-post', 'rkt', :'ben', 'A club post to remove.');

set local role authenticated;
do $$
begin
  if has_function_privilege('anon', 'public.admin_delete_club(text,text)', 'execute') then
    raise exception 'Anonymous can execute club deletion';
  end if;
  begin
    perform public.admin_delete_club('rkt', 'Rocketry Club');
    raise exception 'A club owner without platform admin access deleted the club';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', :'maya', true);
do $$
begin
  begin
    perform public.admin_delete_club('rkt', 'Wrong club name');
    raise exception 'A wrong confirmation deleted the club';
  exception when raise_exception then
    if sqlerrm <> 'Type the exact club name to confirm.' then raise; end if;
  end;
  perform public.admin_delete_club('rkt', 'Rocketry Club');
end $$;
reset role;

do $$
begin
  if exists (select 1 from public.communities where id = 'rkt')
     or exists (select 1 from public.community_members where community_id = 'rkt')
     or exists (select 1 from public.posts where id = 'club-delete-post') then
    raise exception 'Club content still exists';
  end if;
  if not exists (select 1 from public.projects where id = 'p1')
     or not exists (select 1 from public.milestones where id = 'm1' and status = 'verified' and community_id is null and community_name = 'Rocketry Club') then
    raise exception 'Member project or signed milestone lost';
  end if;
  if not exists (select 1 from public.milestones where id = 'club-delete-pending' and status = 'draft' and community_id is null and evidence = 'https://example.com/test') then
    raise exception 'Pending milestone was not returned to its member';
  end if;
  if not exists (select 1 from public.milestones where id = 'club-delete-dispute' and status = 'disputed' and escalated)
     or not exists (select 1 from public.admin_queue where kind = 'dispute' and subject_id = 'club-delete-dispute' and status = 'open') then
    raise exception 'Club dispute was not escalated';
  end if;
  if not exists (select 1 from public.admin_queue where kind = 'club_deleted' and subject_id = 'rkt' and status = 'resolved') then
    raise exception 'Club deletion was not recorded';
  end if;
end $$;
rollback;
\echo 'Club deletion tests passed'
