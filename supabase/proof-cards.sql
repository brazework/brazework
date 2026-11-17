-- Proof cards (Linear FIX-128): a member shares one signed or GitHub-backed result as a public link
-- (/p/<id>) with a preview image, so it can be posted anywhere. Run after backed.sql. Additive; safe
-- to run again.
--
-- Sharing is opt-in, one result at a time: milestones.shared_at is set only by share_milestone(),
-- for the owner's own signed (verified) or backed (logged + backed) result, and cleared again by
-- "Stop sharing". Sharing also shows it on their profile (private = false).
-- public_proof() is the only way in for someone who isn't signed in: it returns the public-safe
-- fields of a shared, public, signed or backed result on a public project, and nothing otherwise.

alter table public.milestones add column if not exists shared_at timestamptz;

create or replace function public.share_milestone(p_id text, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
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
    'witness', case when m.status = 'verified' then jsonb_build_object('name', m.reviewer_name, 'role', m.reviewer_role, 'club', m.community_name, 'vouched_by', m.vouched_by, 'at', m.reviewed_at) end,
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
create or replace function public.proof_cards_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.proof_cards_ready() to authenticated;
