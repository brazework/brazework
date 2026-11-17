-- Backed by GitHub: the middle level of proof, between logged and signed (Linear FIX-121; design in
-- docs/superpowers/specs/2026-11-17-backed-by-github-design.md). Run after study-groups.sql.
-- Additive; safe to run again.
--
-- 1. milestone_backings: one row per milestone that GitHub backs, saying what was checked (a commit,
--    a merged pull request or a published release), in which repo, made by which GitHub account, and
--    when. Only the server writes it, with the service key, after asking GitHub through Brazework's
--    read-only App and comparing the author with the GitHub account the member proved at sign-in
--    (web/src/lib/backing.ts, backing-check.ts). Members can never write it.
-- 2. A new milestone status, 'logged': added with nobody asked to sign it. It never enters a club's
--    queue and doesn't count toward the 20 waiting for review. It only shows to others once it's
--    backed; until then it's the member's own note.
-- 3. A logged milestone that's backed shows to everyone signed in, labelled "Backed by GitHub" (never
--    "Verified"), while the member shows it and the project can be seen. Only logged ones: a milestone
--    that was sent for signing keeps today's rule (others see it once signed), so a club's refusal
--    note, a dispute or "waiting for" never leaks through its backing.
-- 4. One commit, pull request or release backs one milestone, so the same work can't be counted twice.

-- 1. The backings.
create table if not exists public.milestone_backings (
  milestone_id text primary key references public.milestones (id) on delete cascade,
  source text not null default 'github' check (source in ('github')),
  kind text not null check (kind in ('commit', 'pull_request', 'release')),
  url text not null check (url ~ '^https://github\.com/' and char_length(url) <= 300),
  repo_full_name text not null check (repo_full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  ref text not null check (char_length(ref) between 1 and 200),
  github_user_id bigint not null,
  checked_at timestamptz not null default now()
);
create unique index if not exists milestone_backings_once on public.milestone_backings (lower(repo_full_name), kind, ref);
alter table public.milestone_backings enable row level security;
revoke all on public.milestone_backings from anon, authenticated;
grant select on public.milestone_backings to authenticated;
-- Readable exactly when its milestone is (the milestones policy runs inside this check).
drop policy if exists "read backings" on public.milestone_backings;
create policy "read backings" on public.milestone_backings for select to authenticated
  using (exists (select 1 from public.milestones m where m.id = milestone_id));

-- Whether a milestone is backed, for the milestones read rule below. Security definer so the rule
-- doesn't loop back through the backings' own policy.
create or replace function public.milestone_backed(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.milestone_backings b where b.milestone_id = p_id)
$$;
revoke execute on function public.milestone_backed(text) from public, anon;
grant execute on function public.milestone_backed(text) to authenticated;

-- 2. The 'logged' status.
alter table public.milestones drop constraint if exists milestones_status_check;
alter table public.milestones add constraint milestones_status_check
  check (status in ('draft', 'logged', 'pending', 'verified', 'refused', 'declined', 'revoked', 'disputed'));

-- Same as vouches.sql, plus: 'logged' stays logged, with no club (nobody was asked).
create or replace function public.milestones_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.owner_id := auth.uid();
  if new.status = 'logged' then new.community_id := null; end if;
  new.community_name := coalesce((select name from public.communities where id = new.community_id), '');
  new.reviewer_id := null; new.reviewer_name := ''; new.reviewer_role := ''; new.review_note := ''; new.reviewed_at := null;
  new.revoked_reason := ''; new.dispute_note := ''; new.escalated := false; new.vouched_by := '';
  new.verifiers_required := coalesce((select verifiers_required from public.communities where id = new.community_id), 1);
  if new.status is distinct from 'draft' and new.status is distinct from 'logged' then new.status := 'pending'; end if;
  if new.status in ('pending', 'logged') and new.evidence = '' and jsonb_array_length(new.evidence_items) = 0 then
    raise exception 'Add evidence first: a link, a commit, a photo or video, a file, or the club event where it happened.' using errcode = 'P0001';
  end if;
  if new.status = 'pending' and (select count(*) from public.milestones where owner_id = new.owner_id and status = 'pending') >= 20 then
    raise exception 'You have 20 milestones waiting for review. Wait for some to be reviewed first.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- A logged milestone can be removed by its owner, like one still waiting.
drop policy if exists "remove your milestones" on public.milestones;
create policy "remove your milestones" on public.milestones for delete to authenticated
  using (owner_id = auth.uid() and status in ('draft', 'logged', 'pending', 'refused', 'declined'));

-- 3. Who can read a milestone: project-access.sql's rule, plus backed ones.
drop policy if exists "read milestones" on public.milestones;
create policy "read milestones" on public.milestones for select to authenticated using (
  owner_id = auth.uid()
  or (status = 'verified' and not private and public.can_read_project(project_id))
  or (status <> 'draft' and public.my_rank(community_id) >= 3)
  or (status = 'logged' and not private and public.can_read_project(project_id) and public.milestone_backed(id))
);

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.backed_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.backed_ready() to authenticated;
