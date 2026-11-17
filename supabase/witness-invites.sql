-- Witness invitations (Linear FIX-129): when a member shares a result (proof-cards.sql), the person
-- who signed it hears about it, and the public card shows how many results that witness has signed.
-- Run after proof-cards.sql. Additive; safe to run again.
--
-- 1. A new notification kind, 'proof_shared', with the milestone it's about (notifications.milestone_id),
--    so it opens the card. Sent by share_milestone() to a member who signed it, the first time only.
-- 2. public_proof() adds the witness's signed_count: results they've signed on Brazework (verified
--    milestones for a member; vouches from the same address for someone who vouched by email).
-- Someone who vouched by email gets one email instead (web/src/lib/witness-invite.ts); nothing here
-- stores or sends email.

alter table public.notifications add column if not exists milestone_id text references public.milestones (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'like', 'comment', 'follow', 'connect_request', 'connect_accepted', 'community_request', 'community_approved',
  'milestone_request', 'milestone_verified', 'milestone_declined', 'mention', 'company_view', 'proof_shared'));

create or replace function public.share_milestone(p_id text, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare first_share boolean; ms public.milestones;
begin
  select * into ms from public.milestones where id = p_id and owner_id = auth.uid();
  first_share := p_on and ms.id is not null and ms.shared_at is null;
  if p_on and exists (select 1 from public.milestones m join public.projects p on p.id = m.project_id where m.id = p_id and m.owner_id = auth.uid() and p.private) then
    raise exception 'This project is private, so its results can''t be shared. Make the project public first.' using errcode = 'P0001';
  end if;
  update public.milestones m
     set shared_at = case when p_on then coalesce(m.shared_at, now()) else null end,
         private = case when p_on then false else m.private end
   where m.id = p_id and m.owner_id = auth.uid()
     and (not p_on or m.status = 'verified' or (m.status = 'logged' and exists (select 1 from public.milestone_backings b where b.milestone_id = m.id)));
  if not found then
    raise exception 'Only your own signed or backed work can be shared.' using errcode = 'P0001';
  end if;
  -- The witness hears about it once, the first time (a member who signed: a notification that opens
  -- the card; someone who vouched by email gets one email from the app, lib/witness-invite.ts).
  if first_share and ms.status = 'verified' and ms.reviewer_id is not null then
    perform public.notify(ms.reviewer_id, auth.uid(), 'proof_shared', null, null, ms.community_id, ms.title);
    update public.notifications set milestone_id = ms.id
     where user_id = ms.reviewer_id and actor_id = auth.uid() and kind = 'proof_shared' and milestone_id is null;
  end if;
  return p_on;
end $$;
revoke execute on function public.share_milestone(text, boolean) from public, anon;
grant execute on function public.share_milestone(text, boolean) to authenticated;

create or replace function public.public_proof(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'detail', m.detail, 'achieved_on', m.achieved_on,
    'level', case when m.status = 'verified' then 'signed' else 'backed' end,
    'project', p.title,
    'member', jsonb_build_object('id', pr.id, 'first', pr.first_name, 'last', pr.last_name, 'headline', coalesce(pr.headline, ''), 'avatar', coalesce(pr.avatar_path, '')),
    'witness', case when m.status = 'verified' then jsonb_build_object('name', m.reviewer_name, 'role', m.reviewer_role, 'club', m.community_name, 'vouched_by', m.vouched_by, 'at', m.reviewed_at,
      'signed_count', case when m.reviewer_id is not null then (select count(*) from public.milestones x where x.reviewer_id = m.reviewer_id and x.status = 'verified')
                           else (select count(*) from public.milestone_vouches v2 where v2.state = 'vouched' and v2.email = (select v.email from public.milestone_vouches v where v.milestone_id = m.id and v.state = 'vouched' order by v.answered_at desc limit 1)) end) end,
    'backing', (select jsonb_build_object('kind', b.kind, 'repo', b.repo_full_name, 'ref', b.ref, 'url', b.url) from public.milestone_backings b where b.milestone_id = m.id),
    'image', (select e->>'path' from jsonb_array_elements(m.evidence_items) e where e->>'type' = 'image' limit 1),
    'shared_at', m.shared_at)
  from public.milestones m
  join public.projects p on p.id = m.project_id
  join public.profiles pr on pr.id = m.owner_id
  where m.id = p_id and m.shared_at is not null and not m.private and not p.private
    and (m.status = 'verified' or (m.status = 'logged' and exists (select 1 from public.milestone_backings b where b.milestone_id = m.id)))
$$;
revoke execute on function public.public_proof(text) from public;
grant execute on function public.public_proof(text) to anon, authenticated;

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.witness_invites_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.witness_invites_ready() to authenticated;
