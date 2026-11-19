-- Waiting cards (the Product Hunt launch, docs/superpowers/specs/2026-11-19-mcp-elite-design.md): a
-- member can share a milestone that's waiting for its signature, so someone on their own has a link to
-- post the day they log it. Run after witness-invites.sql (it redefines its two functions, adding only
-- what's below). Additive; safe to run again.
--
-- A waiting card says plainly that nobody has signed it yet, and who was asked: the club, or the kind
-- of person and their school or company domain ("a professor at utexas.edu"), never their address.
-- The same link becomes the signed card when they sign; if they refuse, the link stops working.

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
     and (not p_on or m.status in ('verified', 'pending') or (m.status = 'logged' and exists (select 1 from public.milestone_backings b where b.milestone_id = m.id)));
  if not found then
    raise exception 'Only your own signed, backed or waiting work can be shared. Ask someone to sign it first.' using errcode = 'P0001';
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
    'level', case when m.status = 'verified' then 'signed' when m.status = 'pending' then 'waiting' else 'backed' end,
    'project', p.title,
    'member', jsonb_build_object('id', pr.id, 'first', pr.first_name, 'last', pr.last_name, 'headline', coalesce(pr.headline, ''), 'avatar', coalesce(pr.avatar_path, '')),
    'witness', case when m.status = 'verified' then jsonb_build_object('name', m.reviewer_name, 'role', m.reviewer_role, 'club', m.community_name, 'vouched_by', m.vouched_by, 'at', m.reviewed_at,
      'signed_count', case when m.reviewer_id is not null then (select count(*) from public.milestones x where x.reviewer_id = m.reviewer_id and x.status = 'verified')
                           else (select count(*) from public.milestone_vouches v2 where v2.state = 'vouched' and v2.email = (select v.email from public.milestone_vouches v where v.milestone_id = m.id and v.state = 'vouched' order by v.answered_at desc limit 1)) end) end,
    -- Who was asked, for a waiting card: the club, or the kind of person and their domain, never the address.
    'waiting_for', case when m.status = 'pending' then jsonb_build_object(
      'club', case when m.community_id is not null then coalesce(nullif(m.community_name, ''), (select c.name from public.communities c where c.id = m.community_id)) end,
      'asked', (select jsonb_build_object('relationship', v.relationship, 'domain', split_part(v.email, '@', 2))
                  from public.milestone_vouches v where v.milestone_id = m.id and v.state = 'asked' order by v.created_at desc limit 1)) end,
    'backing', (select jsonb_build_object('kind', b.kind, 'repo', b.repo_full_name, 'ref', b.ref, 'url', b.url) from public.milestone_backings b where b.milestone_id = m.id),
    'image', (select e->>'path' from jsonb_array_elements(m.evidence_items) e where e->>'type' = 'image' limit 1),
    'shared_at', m.shared_at)
  from public.milestones m
  join public.projects p on p.id = m.project_id
  join public.profiles pr on pr.id = m.owner_id
  where m.id = p_id and m.shared_at is not null and not m.private and not p.private
    and (m.status in ('verified', 'pending') or (m.status = 'logged' and exists (select 1 from public.milestone_backings b where b.milestone_id = m.id)))
$$;
revoke execute on function public.public_proof(text) from public;
grant execute on function public.public_proof(text) to anon, authenticated;

create or replace function public.waiting_cards_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.waiting_cards_ready() to authenticated;
