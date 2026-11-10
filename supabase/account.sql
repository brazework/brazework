-- Account deletion by the member themselves. Run after public-stats.sql. Additive.
-- Deleting the login removes the profile, and with it everything the member authored (posts,
-- replies, projects, milestones, messages, memberships: their foreign keys cascade). The
-- verification log keeps its records with the actor anonymized (actor_id set to null).
-- Clubs they own must be handed off first, so a club is never left without an owner.
create function public.delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); owned text;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if p_confirm is distinct from 'DELETE' then raise exception 'Type DELETE to confirm.' using errcode = 'P0001'; end if;
  select string_agg(c.name, ', ') into owned from public.community_members m join public.communities c on c.id = m.community_id
   where m.uid = me and m.role = 'owner'
     and exists (select 1 from public.community_members o where o.community_id = m.community_id and o.uid <> me);
  if owned is not null then
    raise exception 'Hand off these clubs first (Club → Manage → Hand off): %', owned using errcode = 'P0001';
  end if;
  -- Clubs you own alone go with you.
  delete from public.communities c where c.owner_id = me
    and not exists (select 1 from public.community_members o where o.community_id = c.id and o.uid <> me);
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account(text) from anon, public;
grant execute on function public.delete_my_account(text) to authenticated;
