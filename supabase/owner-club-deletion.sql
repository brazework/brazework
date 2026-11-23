-- Once enabled, only the current owner of a club can delete it.
begin;

drop function if exists public.admin_delete_club(text, text);

-- Older web deployments hide their admin-only control during the rollout.
create or replace function public.club_deletion_ready() returns boolean
language sql stable set search_path = '' as $$ select false $$;
revoke execute on function public.club_deletion_ready() from public, anon;
grant execute on function public.club_deletion_ready() to authenticated;

create or replace function public.delete_owned_club(p_cid text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  club_name text;
begin
  select name into club_name
    from public.communities
   where id = p_cid and owner_id = auth.uid()
   for update;
  if not found then
    raise exception 'Only the club owner can delete this club.' using errcode = '42501';
  end if;

  if p_name is distinct from club_name then
    raise exception 'Type the exact club name to confirm.' using errcode = 'P0001';
  end if;

  -- Detach milestones before the club's foreign keys cascade. Signed work keeps the club name.
  -- Unfinished requests return to their members as drafts, so they can ask someone else.
  with detached as (
    update public.milestones
       set community_id = null,
           community_name = case when status = 'pending' then '' else community_name end,
           status = case when status = 'pending' then 'draft' else status end,
           shared_at = case when status = 'pending' then null else shared_at end,
           escalated = escalated or status = 'disputed'
     where community_id = p_cid
     returning id, status, dispute_note
  )
  insert into public.admin_queue (kind, subject_id, detail)
  select 'dispute', d.id, left(coalesce(d.dispute_note, ''), 500)
    from detached d
   where d.status = 'disputed' and not exists (
     select 1 from public.admin_queue q where q.kind = 'dispute' and q.subject_id = d.id and q.status = 'open'
   );

  delete from public.communities where id = p_cid;

  insert into public.admin_queue (kind, subject_id, detail, status, resolution, resolved_at)
  values ('club_deleted', p_cid, club_name, 'resolved', 'Deleted by ' || auth.uid()::text, now());
end $$;

revoke execute on function public.delete_owned_club(text, text) from public, anon;
grant execute on function public.delete_owned_club(text, text) to authenticated;

create or replace function public.owner_club_deletion_ready() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke execute on function public.owner_club_deletion_ready() from public, anon;
grant execute on function public.owner_club_deletion_ready() to authenticated;

commit;
