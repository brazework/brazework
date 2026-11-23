\set QUIET on
begin;
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
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
  if to_regprocedure('public.admin_delete_club(text,text)') is not null
     or public.club_deletion_ready()
     or not public.owner_club_deletion_ready() then
    raise exception 'Only the new owner-only delete path should be available';
  end if;
  if has_function_privilege('anon', 'public.delete_owned_club(text,text)', 'execute') then
    raise exception 'Anonymous can execute club deletion';
  end if;
  if has_table_privilege('authenticated', 'public.communities', 'DELETE') then
    raise exception 'Direct table deletion bypasses the owner-only RPC';
  end if;
end $$;

select set_config('request.jwt.claim.sub', :'maya', true);
do $$
begin
  if not public.is_forge_admin() or public.my_rank('rkt') <> 4 then
    raise exception 'Expected a platform and club admin who does not own the club';
  end if;
  begin
    perform public.delete_owned_club('rkt', 'Rocketry Club');
    raise exception 'A non-owner admin deleted the club';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', :'josh', true);
do $$
begin
  begin
    perform public.delete_owned_club('rkt', 'Rocketry Club');
    raise exception 'A club member deleted the club';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', :'ben', true);
do $$
begin
  begin
    perform public.delete_owned_club('rkt', 'Wrong club name');
    raise exception 'A wrong confirmation deleted the club';
  exception when raise_exception then
    if sqlerrm <> 'Type the exact club name to confirm.' then raise; end if;
  end;
  perform public.delete_owned_club('rkt', 'Rocketry Club');
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
