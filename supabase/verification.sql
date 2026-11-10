-- Verification, made airtight. Run after project-posts.sql. Additive: existing milestones keep
-- working (old 'declined' reads as refused; old milestones stay public).
--
-- The rules (each has a test in supabase/tests/verification.test.sql):
--  1. Only a club's officers (moderator and up) verify, never on a project they own or are on.
--  2. Evidence is required to ask: a link, a commit, a photo or video, a file, or the club event
--     where it happened. No evidence, no request.
--  3. Each club sets 1 or 2 verifiers per milestone (default 1). With 2, two different officers.
--  4. The badge shows who verified it, their role, the club and the date.
--  5. Anti-gaming: a weekly cap per officer (config), and officers verifying far above their club's
--     average are flagged to the Forge admin queue.
--  6. The club can revoke, with a reason; the badge disappears everywhere, the log keeps it.
--  7. Disputes: the member disputes a refusal or revocation → the club owner decides → if the owner
--     rejects it, it goes to Forge admins.
--  8. Verified milestones stay when the member leaves the club or graduates. Officers lose
--     verifying power the moment their role ends (checked at the time of each action).
--  9. A "verified club" needs a school-email officer and N members with verified work (config).
-- Every change goes through a function here and is written to verification_events (append-only).

-- ---------- Settings (Forge-wide; changed with the service role only) ----------
create table public.app_config (key text primary key, value jsonb not null);
alter table public.app_config enable row level security;
create policy "read config" on public.app_config for select to authenticated using (true);
revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to authenticated;
insert into public.app_config (key, value) values
  ('verify_weekly_limit', '25'),          -- verifications per officer per 7 days
  ('verify_outlier_factor', '3'),         -- flag an officer above this × their club's officer average
  ('verify_outlier_min', '10'),           -- ...once they've verified at least this many in the week
  ('verified_club_min_members', '5');     -- members with verified work for a "verified club"

create function public.config_int(k text, fallback int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = k), fallback)
$$;

-- ---------- Forge admins and their queue ----------
create table public.forge_admins (uid uuid primary key references public.profiles (id) on delete cascade);
alter table public.forge_admins enable row level security;
revoke all on public.forge_admins from anon, authenticated;

create function public.is_forge_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.forge_admins where uid = auth.uid())
$$;

create table public.admin_queue (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('verify_outlier', 'dispute', 'duplicate_club', 'report')),
  subject_id text not null,
  community_id text references public.communities (id) on delete set null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index admin_queue_open_idx on public.admin_queue (created_at desc) where status = 'open';
alter table public.admin_queue enable row level security;
create policy "admins read the queue" on public.admin_queue for select to authenticated using (public.is_forge_admin());
revoke all on public.admin_queue from anon, authenticated;
grant select on public.admin_queue to authenticated;

-- ---------- Project teams (rule 1: no verifying a project you're on) ----------
create table public.project_members (
  project_id text not null references public.projects (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, uid)
);
alter table public.project_members enable row level security;
create policy "see a project's team" on public.project_members for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and (not p.private or p.owner_id = auth.uid())) or uid = auth.uid());
create policy "owners add teammates" on public.project_members for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "owners remove teammates, or leave" on public.project_members for delete to authenticated
  using (uid = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
grant select, delete on public.project_members to authenticated;
grant insert (project_id, uid) on public.project_members to authenticated;

create function public.on_project_team(p_project text, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p_project and owner_id = p_uid)
      or exists (select 1 from public.project_members where project_id = p_project and uid = p_uid)
$$;

-- ---------- Clubs: how many verifiers ----------
alter table public.communities add column verifiers_required smallint not null default 1 check (verifiers_required between 1 and 2);
grant select (verifiers_required) on public.communities to authenticated;

create function public.set_verifiers_required(p_cid text, p_n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_rank(p_cid) < 4 then raise exception 'Only the club''s owner and admins can change this.' using errcode = '42501'; end if;
  if p_n not between 1 and 2 then raise exception 'Choose 1 or 2 verifiers.' using errcode = 'P0001'; end if;
  update public.communities set verifiers_required = p_n where id = p_cid;
end $$;

-- ---------- Milestones: statuses, evidence, badge, privacy ----------
alter table public.milestones drop constraint milestones_status_check;
alter table public.milestones add constraint milestones_status_check
  check (status in ('draft', 'pending', 'verified', 'refused', 'declined', 'revoked', 'disputed'));
-- Evidence beyond the single link: [{ "type": "link"|"commit"|"image"|"video"|"file"|"event", "url"|"path"|"event_id": "…" }]
alter table public.milestones add column evidence_items jsonb not null default '[]'::jsonb
  check (jsonb_typeof(evidence_items) = 'array' and jsonb_array_length(evidence_items) <= 8);
alter table public.milestones add column reviewer_role text not null default '';
alter table public.milestones add column verifiers_required smallint not null default 1;
alter table public.milestones add column revoked_reason text not null default '' check (char_length(revoked_reason) <= 300);
alter table public.milestones add column dispute_note text not null default '' check (char_length(dispute_note) <= 500);
alter table public.milestones add column escalated boolean not null default false;
-- Private by default for new milestones; existing ones stay as they were (public once verified).
alter table public.milestones add column private boolean not null default false;
alter table public.milestones alter column private set default true;
grant insert (evidence_items, private, status) on public.milestones to authenticated; -- status: only draft or pending survive the insert trigger
grant update (private) on public.milestones to authenticated;
create policy "show or hide your milestones" on public.milestones for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Each evidence item is checked; anything else is refused.
create function public.evidence_ok(items jsonb, owner uuid) returns boolean
language plpgsql immutable as $$
declare e jsonb;
begin
  for e in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    case e->>'type'
      when 'link', 'commit' then if coalesce(e->>'url', '') !~ '^https://[^\s]+$' or char_length(e->>'url') not between 12 and 300 then return false; end if;
      when 'image', 'video', 'file' then if not public.media_path_ok(coalesce(e->>'path', ''), owner) or coalesce(e->>'path', '') = '' then return false; end if;
      when 'event' then if coalesce(e->>'event_id', '') !~ '^[A-Za-z0-9-]{1,64}$' then return false; end if;
      else return false;
    end case;
  end loop;
  return true;
end $$;
alter table public.milestones add constraint milestones_evidence_ok check (public.evidence_ok(evidence_items, owner_id));

-- Readable: verified and not private, or yours, or your club's officers. Never a draft but yours.
drop policy "read milestones" on public.milestones;
create policy "read milestones" on public.milestones for select to authenticated
  using (owner_id = auth.uid()
      or (status = 'verified' and not private)
      or (status <> 'draft' and public.my_rank(community_id) >= 3));

-- A verified record can't be deleted by its owner (hide it instead); drafts, pending and refused can.
drop policy "remove your milestones" on public.milestones;
create policy "remove your milestones" on public.milestones for delete to authenticated
  using (owner_id = auth.uid() and status in ('draft', 'pending', 'refused', 'declined'));

-- ---------- The log ----------
create table public.verification_events (
  id bigint generated always as identity primary key,
  milestone_id text not null,
  community_id text,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null default '',
  action text not null check (action in ('submitted', 'approved', 'verified', 'refused', 'revoked', 'disputed', 'dispute_upheld', 'dispute_rejected', 'escalated', 'admin_upheld', 'admin_rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index verification_events_milestone_idx on public.verification_events (milestone_id, created_at);
create index verification_events_actor_idx on public.verification_events (actor_id, action, created_at);
alter table public.verification_events enable row level security;
create policy "read the log of milestones you can see" on public.verification_events for select to authenticated
  using (exists (select 1 from public.milestones m where m.id = milestone_id));
revoke all on public.verification_events from anon, authenticated;
grant select on public.verification_events to authenticated;
-- Append-only, even for the functions below. The one change allowed: when an account is deleted,
-- its actor_id becomes null (the record stays, anonymized).
create function public.verification_events_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and (new.milestone_id, new.community_id, new.actor_role, new.action, new.note, new.created_at)
         is not distinct from (old.milestone_id, old.community_id, old.actor_role, old.action, old.note, old.created_at) then
    return new;
  end if;
  raise exception 'The verification log is append-only.';
end $$;
create trigger verification_events_no_update before update or delete on public.verification_events
  for each row execute function public.verification_events_immutable();

create function public.log_verification(p_m text, p_cid text, p_action text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.community_members where community_id = p_cid and uid = auth.uid();
  insert into public.verification_events (milestone_id, community_id, actor_id, actor_role, action, note)
  values (p_m, p_cid, auth.uid(), coalesce(r, case when public.is_forge_admin() then 'forge admin' else '' end), p_action, left(coalesce(p_note, ''), 500));
end $$;

-- ---------- Asking (rule 2) ----------
create or replace function public.milestones_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.owner_id := auth.uid();
  new.community_name := coalesce((select name from public.communities where id = new.community_id), '');
  new.reviewer_id := null; new.reviewer_name := ''; new.reviewer_role := ''; new.review_note := ''; new.reviewed_at := null;
  new.revoked_reason := ''; new.dispute_note := ''; new.escalated := false;
  new.verifiers_required := coalesce((select verifiers_required from public.communities where id = new.community_id), 1);
  if new.status is distinct from 'draft' then new.status := 'pending'; end if;
  if new.status = 'pending' and new.evidence = '' and jsonb_array_length(new.evidence_items) = 0 then
    raise exception 'Add evidence first: a link, a commit, a photo or video, a file, or the club event where it happened.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.milestones where owner_id = new.owner_id and status = 'pending') >= 20 then
    raise exception 'You have 20 milestones waiting for review. Wait for some to be reviewed first.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create function public.milestones_log_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then perform public.log_verification(new.id, new.community_id, 'submitted', ''); end if;
  return new;
end $$;
create trigger milestones_log_insert after insert on public.milestones
  for each row execute function public.milestones_log_insert();

-- Submit a draft once it has evidence.
create function public.submit_milestone(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.milestones;
begin
  select * into m from public.milestones where id = p_id and owner_id = auth.uid() for update;
  if m.id is null or m.status <> 'draft' then raise exception 'Only your drafts can be submitted.' using errcode = 'P0001'; end if;
  if m.evidence = '' and jsonb_array_length(m.evidence_items) = 0 then
    raise exception 'Add evidence first: a link, a commit, a photo or video, a file, or the club event where it happened.' using errcode = 'P0001';
  end if;
  update public.milestones set status = 'pending' where id = p_id;
  perform public.log_verification(p_id, m.community_id, 'submitted', '');
end $$;

-- ---------- Reviewing (rules 1, 3, 4, 5) ----------
create or replace function public.review_milestone(p_id text, p_verify boolean, p_note text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  m public.milestones;
  me public.profiles;
  my_role text;
  approvals int;
  week int;
  club_avg numeric;
  result text;
begin
  select * into m from public.milestones where id = p_id for update;
  if m.id is null then raise exception 'That milestone no longer exists.' using errcode = 'P0001'; end if;
  if m.status <> 'pending' then raise exception 'That milestone has already been reviewed.' using errcode = 'P0001'; end if;
  if public.on_project_team(m.project_id, auth.uid()) then raise exception 'You can''t verify a project you own or are on.' using errcode = '42501'; end if;
  if public.my_rank(m.community_id) < 3 then raise exception 'Only the club''s moderators, admins and owner can review milestones.' using errcode = '42501'; end if;
  -- Approvals count since the latest submission (log order by id: timestamps tie within a transaction).
  if exists (select 1 from public.verification_events where milestone_id = p_id and actor_id = auth.uid() and action = 'approved'
             and id > coalesce((select max(id) from public.verification_events where milestone_id = p_id and action = 'submitted'), 0)) then
    raise exception 'You''ve already approved this one; it needs another officer.' using errcode = 'P0001';
  end if;
  select * into me from public.profiles where id = auth.uid();
  select role into my_role from public.community_members where community_id = m.community_id and uid = auth.uid();

  if not p_verify then
    update public.milestones set status = 'refused', reviewer_id = auth.uid(), reviewer_role = my_role,
      reviewer_name = btrim(coalesce(me.first_name, '') || ' ' || left(coalesce(me.last_name, ''), 1) || case when coalesce(me.last_name, '') <> '' then '.' else '' end),
      review_note = left(btrim(coalesce(p_note, '')), 300), reviewed_at = now() where id = p_id;
    perform public.log_verification(p_id, m.community_id, 'refused', p_note);
    perform public.notify(m.owner_id, auth.uid(), 'milestone_declined', null, null, m.community_id, m.title);
    return 'refused';
  end if;

  week := (select count(*) from public.verification_events where actor_id = auth.uid() and action = 'approved' and created_at > now() - interval '7 days');
  if week >= public.config_int('verify_weekly_limit', 25) then
    raise exception 'You''ve reached this week''s verification limit. Ask another officer, or try again in a few days.' using errcode = 'P0001';
  end if;

  perform public.log_verification(p_id, m.community_id, 'approved', p_note);
  approvals := (select count(distinct actor_id) from public.verification_events where milestone_id = p_id and action = 'approved'
                and id > coalesce((select max(id) from public.verification_events where milestone_id = p_id and action = 'submitted'), 0));
  if approvals >= m.verifiers_required then
    update public.milestones set status = 'verified', reviewer_id = auth.uid(), reviewer_role = my_role,
      reviewer_name = btrim(coalesce(me.first_name, '') || ' ' || left(coalesce(me.last_name, ''), 1) || case when coalesce(me.last_name, '') <> '' then '.' else '' end),
      review_note = left(btrim(coalesce(p_note, '')), 300), reviewed_at = now() where id = p_id;
    perform public.log_verification(p_id, m.community_id, 'verified', '');
    perform public.notify(m.owner_id, auth.uid(), 'milestone_verified', null, null, m.community_id, m.title);
    result := 'verified';
  else
    result := 'pending';
  end if;

  -- Rule 5: far above the club's officer average this week → admin queue (once per officer per week).
  club_avg := (select avg(n) from (select count(*) n from public.verification_events
                where community_id = m.community_id and action = 'approved' and created_at > now() - interval '7 days' group by actor_id) s);
  if week + 1 >= public.config_int('verify_outlier_min', 10) and week + 1 > public.config_int('verify_outlier_factor', 3) * coalesce(club_avg, 0)
     and not exists (select 1 from public.admin_queue where kind = 'verify_outlier' and subject_id = auth.uid()::text and created_at > now() - interval '7 days') then
    insert into public.admin_queue (kind, subject_id, community_id, detail)
    values ('verify_outlier', auth.uid()::text, m.community_id, format('%s verifications this week; club officer average %s', week + 1, round(coalesce(club_avg, 0), 1)));
  end if;
  return result;
end $$;

-- ---------- Revoking (rule 6) ----------
create function public.revoke_milestone(p_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.milestones;
begin
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.status <> 'verified' then raise exception 'Only verified milestones can be revoked.' using errcode = 'P0001'; end if;
  if public.my_rank(m.community_id) < 3 or public.on_project_team(m.project_id, auth.uid()) then
    raise exception 'Only the club''s officers (not on this project) can revoke it.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Say why it''s being revoked.' using errcode = 'P0001'; end if;
  update public.milestones set status = 'revoked', revoked_reason = left(btrim(p_reason), 300) where id = p_id;
  perform public.log_verification(p_id, m.community_id, 'revoked', p_reason);
  perform public.notify(m.owner_id, auth.uid(), 'milestone_declined', null, null, m.community_id, m.title);
end $$;

-- ---------- Disputes (rule 7) ----------
create function public.dispute_milestone(p_id text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.milestones; owner uuid;
begin
  select * into m from public.milestones where id = p_id and owner_id = auth.uid() for update;
  if m.id is null or m.status not in ('refused', 'declined', 'revoked') then
    raise exception 'You can dispute your own refused or revoked milestones.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'Explain what happened (at least a sentence).' using errcode = 'P0001'; end if;
  update public.milestones set status = 'disputed', dispute_note = left(btrim(p_note), 500), escalated = false where id = p_id;
  perform public.log_verification(p_id, m.community_id, 'disputed', p_note);
  select uid into owner from public.community_members where community_id = m.community_id and role = 'owner' limit 1;
  if owner is not null then perform public.notify(owner, auth.uid(), 'milestone_request', null, null, m.community_id, m.title); end if;
end $$;

-- The club owner decides; rejecting sends it to Forge admins.
create function public.resolve_dispute(p_id text, p_uphold boolean, p_note text default '') returns text
language plpgsql security definer set search_path = public as $$
declare m public.milestones;
begin
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.status <> 'disputed' or m.escalated then raise exception 'There''s no open dispute for the club to decide.' using errcode = 'P0001'; end if;
  if public.my_rank(m.community_id) < 5 then raise exception 'Only the club''s owner decides disputes.' using errcode = '42501'; end if;
  if public.on_project_team(m.project_id, auth.uid()) then raise exception 'You''re on this project; a Forge admin will decide.' using errcode = '42501'; end if;
  if p_uphold then
    update public.milestones set status = 'verified', revoked_reason = '', reviewed_at = now() where id = p_id;
    perform public.log_verification(p_id, m.community_id, 'dispute_upheld', p_note);
    perform public.notify(m.owner_id, auth.uid(), 'milestone_verified', null, null, m.community_id, m.title);
    return 'verified';
  end if;
  update public.milestones set escalated = true where id = p_id;
  perform public.log_verification(p_id, m.community_id, 'dispute_rejected', p_note);
  perform public.log_verification(p_id, m.community_id, 'escalated', '');
  insert into public.admin_queue (kind, subject_id, community_id, detail) values ('dispute', p_id, m.community_id, left(m.dispute_note, 500));
  return 'escalated';
end $$;

-- Forge admins settle escalated disputes.
create function public.admin_resolve_dispute(p_id text, p_uphold boolean, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare m public.milestones;
begin
  if not public.is_forge_admin() then raise exception 'Forge admins only.' using errcode = '42501'; end if;
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.status <> 'disputed' or not m.escalated then raise exception 'No escalated dispute here.' using errcode = 'P0001'; end if;
  update public.milestones set status = case when p_uphold then 'verified' else 'refused' end, escalated = false where id = p_id;
  perform public.log_verification(p_id, m.community_id, case when p_uphold then 'admin_upheld' else 'admin_rejected' end, p_note);
  update public.admin_queue set status = 'resolved', resolution = left(coalesce(p_note, ''), 500), resolved_at = now()
   where kind = 'dispute' and subject_id = p_id and status = 'open';
  return case when p_uphold then 'verified' else 'refused' end;
end $$;

-- ---------- Verified clubs (rule 9) ----------
-- A school-email officer (verified by the email they signed in with) and N members with verified work.
create function public.club_is_verified(p_cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.community_members cm join auth.users u on u.id = cm.uid
       where cm.community_id = p_cid and public.role_rank(cm.role) >= 3 and u.email_confirmed_at is not null
         and lower(split_part(u.email, '@', 2)) ~ '(^|\.)([a-z0-9-]+\.edu(\.[a-z]{2})?|[a-z0-9-]+\.ac\.[a-z]{2})$')
     and (select count(distinct m.owner_id) from public.milestones m where m.community_id = p_cid and m.status = 'verified')
         >= public.config_int('verified_club_min_members', 5)
$$;

revoke execute on function public.config_int(text, int), public.log_verification(text, text, text, text), public.on_project_team(text, uuid),
  public.milestones_log_insert(), public.verification_events_immutable() from anon, authenticated, public;
revoke execute on function public.submit_milestone(text), public.revoke_milestone(text, text), public.dispute_milestone(text, text),
  public.resolve_dispute(text, boolean, text), public.admin_resolve_dispute(text, boolean, text), public.set_verifiers_required(text, int),
  public.club_is_verified(text), public.is_forge_admin() from anon, public;
grant execute on function public.submit_milestone(text), public.revoke_milestone(text, text), public.dispute_milestone(text, text),
  public.resolve_dispute(text, boolean, text), public.admin_resolve_dispute(text, boolean, text), public.set_verifiers_required(text, int),
  public.club_is_verified(text), public.is_forge_admin() to authenticated;
