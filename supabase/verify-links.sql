-- Step 68: résumé verify links (/v/<id>). Run after mcp-workflows.sql. Additive and safe to re-run.
--
-- Every signed milestone gets a public verify page, for a recruiter who clicks (or scans) it from a
-- résumé: what was built, the evidence, who signed or verified it, their role, when, and whether it
-- still stands. public_verify() is the only way in for someone signed out, and it returns a milestone
-- only when:
--   - it isn't private and its project isn't private (making either private takes the page down), and
--   - it is signed now, or was signed once and has since been revoked (a revoked milestone keeps its
--     page, marked revoked, so a résumé can't keep pointing at proof that was withdrawn).
-- Nothing else: never a draft, a pending ask, a refusal that was never signed, or a backed-only result.
-- What it shows is what members already see on a public milestone, minus the revocation's reason
-- (only that and when it was revoked), minus private evidence (files, videos, club events: counted,
-- never linked). Milestone ids are random UUIDs, so pages can't be walked.

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
    'evidence', coalesce((select jsonb_agg(case when e->>'type' in ('link', 'commit') then jsonb_build_object('type', e->>'type', 'url', e->>'url')
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

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.verify_links_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.verify_links_ready() to authenticated;
