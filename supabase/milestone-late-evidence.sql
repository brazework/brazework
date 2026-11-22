-- Step 90: add evidence to a milestone after it's logged (Linear FIX-238). The owner adds a link (the
-- repo, the CAD, the write-up) to one of their milestones at any time, up to the 8 items a milestone
-- holds (verification.sql). Evidence added after a milestone was signed keeps the signature but is
-- marked with when it was added ("added_at") and that it came after signing ("after_signing"), so
-- nobody can quietly change what a signer saw: the app shows it as "added after signing" with the
-- date. A revoked or disputed milestone can't gain evidence (it's being looked at). The verification log
-- stays as it is: it records signers' actions, and the item itself carries when it was added.
-- Additive and safe to re-run.

create or replace function public.add_milestone_evidence(p_id text, p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.milestones; v_url text := btrim(coalesce(p_url, '')); item jsonb;
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.owner_id <> auth.uid() then raise exception 'Only the milestone''s owner can add evidence.' using errcode = '42501'; end if;
  if m.status in ('revoked', 'disputed') then
    raise exception 'This milestone is being looked at, so its evidence can''t change right now.' using errcode = 'P0001';
  end if;
  if v_url !~ '^https://[^\s]+$' or char_length(v_url) not between 12 and 300 then
    raise exception 'Add a full https:// link, like github.com/you/repo.' using errcode = 'P0001';
  end if;
  if v_url = m.evidence or exists (select 1 from jsonb_array_elements(m.evidence_items) e where e->>'url' = v_url) then
    raise exception 'That link is already on this milestone.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(m.evidence_items) >= 8 then
    raise exception 'A milestone holds up to 8 pieces of evidence. Remove one first.' using errcode = 'P0001';
  end if;
  item := jsonb_build_object('type', case when v_url ~* '^https://github\.com/[^/]+/[^/]+/commit/' then 'commit' else 'link' end,
                             'url', v_url, 'added_at', now(), 'after_signing', m.status = 'verified');
  update public.milestones set evidence_items = evidence_items || jsonb_build_array(item) where id = p_id;
  return item;
end $$;

revoke execute on function public.add_milestone_evidence(text, text) from anon, public;
grant execute on function public.add_milestone_evidence(text, text) to authenticated;

-- The public verify page (verify-links.sql, /v/<id>): the same as before, except a link added after it
-- was signed also carries after_signing and added_at, so a résumé link never passes off later evidence as
-- what was signed. Every other link reads exactly as before.
create or replace function public.public_verify(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  with m as (
    -- Signed now, or revoked (only a verified milestone can be, always with a reason, which a later
    -- dispute or its rejection keeps). Older verified rows predate the event log, so the log isn't needed.
    select m.*, (m.status in ('verified', 'revoked') or (m.status in ('disputed', 'refused', 'declined') and m.revoked_reason <> '')) as was_signed
    from public.milestones m where m.id = p_id
  )
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'detail', m.detail, 'achieved_on', m.achieved_on, 'project', p.title,
    'state', case when m.status = 'verified' then 'valid' when m.status = 'disputed' then 'disputed' else 'revoked' end,
    'member', jsonb_build_object('id', pr.id, 'first', pr.first_name, 'last', pr.last_name, 'headline', coalesce(pr.headline, '')),
    'signer', jsonb_build_object('kind', case when m.vouched_by <> '' then 'vouch' else 'club' end,
      'name', m.reviewer_name, 'role', m.reviewer_role, 'club', m.community_name, 'vouched_by', m.vouched_by, 'at', m.reviewed_at),
    'pro', coalesce((select jsonb_agg(jsonb_build_object('name', r.reviewer_name, 'title', r.reviewer_title, 'employer', r.employer_name, 'at', r.created_at) order by r.created_at)
                     from public.pro_reviews r where r.milestone_id = m.id), '[]'),
    'evidence', coalesce((select jsonb_agg(case when e->>'type' in ('link', 'commit') then jsonb_strip_nulls(jsonb_build_object('type', e->>'type', 'url', e->>'url', 'after_signing', case when (e->>'after_signing')::boolean then true end, 'added_at', case when (e->>'after_signing')::boolean then e->>'added_at' end))
                                                else jsonb_build_object('type', 'image', 'path', e->>'path') end order by o)
                          from jsonb_array_elements(m.evidence_items) with ordinality x(e, o) where e->>'type' in ('link', 'commit', 'image')), '[]'),
    'legacy_evidence', case when m.evidence ~ '^https://[^\s]+$' then m.evidence else '' end,
    'kept_private', (select count(*) from jsonb_array_elements(m.evidence_items) e where e->>'type' in ('video', 'file', 'event')),
    'revoked_at', case when m.status <> 'verified' then (select max(e.created_at) from public.verification_events e where e.milestone_id = m.id and e.action = 'revoked') end,
    'checked_at', now())
  from m
  join public.projects p on p.id = m.project_id
  join public.profiles pr on pr.id = m.owner_id
  where not m.private and not p.private and m.was_signed
    and m.status in ('verified', 'revoked', 'disputed', 'refused', 'declined')
$$;
revoke execute on function public.public_verify(text) from public;
grant execute on function public.public_verify(text) to anon, authenticated;

create or replace function public.milestone_late_evidence_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
