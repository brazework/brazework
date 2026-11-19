-- Step 84: "approved by", the witness a merged pull request already has. Run after waiting-cards.sql
-- (it redefines public_proof) and backed.sql. Additive and safe to re-run.
--
-- When Brazework backs a member's merged pull request with GitHub (backed.sql), it now also reads who
-- reviewed and approved it there: a named colleague stood behind that change at the time, with no
-- email and no form. The record says exactly that: "approved by @sam on GitHub", next to the pull
-- request it was. It's an approval of a pull request, not a signature given to Brazework, so the
-- level stays "Backed by GitHub", never "Verified" or "Signed".
--
-- What's kept (only the server writes it, with the service key, as for the rest of the backing):
--   approvals     how many reviewers' latest decision was "approved" (never the author, never a bot)
--   approvers     their GitHub logins, at most 10, and only for a public repo
--   repo_private  whether the repo was private when checked; then approvers is empty, so a private
--                 repo's reviewers are never named
alter table public.milestone_backings add column if not exists approvals smallint not null default 0;
alter table public.milestone_backings add column if not exists approvers text[] not null default '{}';
alter table public.milestone_backings add column if not exists repo_private boolean not null default true;
alter table public.milestone_backings drop constraint if exists milestone_backings_approvals_ok;
alter table public.milestone_backings add constraint milestone_backings_approvals_ok check (
  approvals between 0 and 99
  and cardinality(approvers) <= 10 and cardinality(approvers) <= approvals
  and (not repo_private or cardinality(approvers) = 0)
  and (kind = 'pull_request' or approvals = 0)
);

-- A login is letters, digits and single hyphens (GitHub's rule), so nothing else can be stored as one.
create or replace function public.github_logins_ok(p text[]) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(bool_and(l ~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$'), true) from unnest(p) as l
$$;
alter table public.milestone_backings drop constraint if exists milestone_backings_approvers_ok;
alter table public.milestone_backings add constraint milestone_backings_approvers_ok check (public.github_logins_ok(approvers));

-- The public share card (waiting-cards.sql), with the approvals next to the backing.
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
    'backing', (select jsonb_build_object('kind', b.kind, 'repo', b.repo_full_name, 'ref', b.ref, 'url', b.url, 'approvals', b.approvals, 'approvers', to_jsonb(b.approvers))
                  from public.milestone_backings b where b.milestone_id = m.id),
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

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.approved_by_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
revoke execute on function public.github_logins_ok(text[]) from public, anon, authenticated;
grant execute on function public.approved_by_ready() to authenticated;
