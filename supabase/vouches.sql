-- Vouches (Linear FIX-94): proof for builders without a club. A member asks someone who saw the work
-- (a professor, TA, lab PI, manager, mentor) to vouch for one milestone. The ask goes by email to a
-- university or verified-company address, and the link in that email is the proof that the person
-- controls that inbox: they don't need an account. They answer two questions (what they saw, how they
-- know the member) and vouch or decline. Run after github.sql. Additive; safe to run again.
--
-- Guards (the fake-reference problem):
--   - only school addresses (is_school_email) or a verified company's domain; never free mail
--   - never the member's own address, a teammate's, or anyone on the project's team
--   - the link is single-use, expires in 14 days, and only its sha256 is stored
--   - at most 3 open asks per milestone, 10 asks a week per member, 8 vouches a month per address
--   - the voucher's name, role, relationship and email domain are shown with the vouch
--   - every step goes in the append-only verification log
--
-- Who writes: request_vouch (the member, signed in) and answer_vouch (anyone holding a live link,
-- as anon). Nobody writes the table directly.

-- A milestone can now stand without a club: vouched instead of club-verified.
alter table public.milestones alter column community_id drop not null;
alter table public.milestones add column if not exists vouched_by text not null default '' check (char_length(vouched_by) <= 160);

-- Members may log a milestone on their own project with no club (it waits for a vouch); with a club,
-- as before, they must belong to it.
drop policy if exists "ask your club to verify" on public.milestones;
create policy "ask your club to verify" on public.milestones for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    and (community_id is null or public.my_rank(community_id) > 0)
  );

-- The log learns the vouch steps.
alter table public.verification_events drop constraint if exists verification_events_action_check;
alter table public.verification_events add constraint verification_events_action_check
  check (action in ('submitted', 'approved', 'verified', 'refused', 'revoked', 'disputed', 'dispute_upheld', 'dispute_rejected', 'escalated', 'admin_upheld', 'admin_rejected',
                    'vouch_requested', 'vouched', 'vouch_declined'));

create table if not exists public.milestone_vouches (
  id bigint generated always as identity primary key,
  milestone_id text not null references public.milestones (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  email text not null check (char_length(email) between 6 and 254),
  relationship text not null check (relationship in ('professor', 'ta', 'pi', 'manager', 'mentor', 'other')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'asked' check (state in ('asked', 'vouched', 'declined', 'expired', 'withdrawn')),
  voucher_name text not null default '' check (char_length(voucher_name) <= 80),
  voucher_title text not null default '' check (char_length(voucher_title) <= 80),
  saw text not null default '' check (char_length(saw) <= 600),
  knows_from text not null default '' check (char_length(knows_from) <= 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  answered_at timestamptz
);
create index if not exists milestone_vouches_milestone_idx on public.milestone_vouches (milestone_id);
create index if not exists milestone_vouches_requester_idx on public.milestone_vouches (requested_by, created_at);
create index if not exists milestone_vouches_email_idx on public.milestone_vouches (lower(email), answered_at);
alter table public.milestone_vouches enable row level security;
revoke all on public.milestone_vouches from anon, authenticated;
-- Members see the asks on their own milestones (never the token hash: that column isn't granted).
drop policy if exists "your vouch asks" on public.milestone_vouches;
create policy "your vouch asks" on public.milestone_vouches for select to authenticated using (requested_by = auth.uid());
grant select (id, milestone_id, email, relationship, state, voucher_name, voucher_title, saw, knows_from, created_at, expires_at, answered_at)
  on public.milestone_vouches to authenticated;

-- A university address, or the domain of a company verified on Brazework. Free mail never counts.
create or replace function public.vouch_email_ok(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_email, '') ~* '^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$'
     and (public.is_school_email(p_email)
          or exists (select 1 from public.organizations o
                     where o.type = 'company' and o.verification_status = 'verified'
                       and lower(o.domain) = lower(split_part(p_email, '@', 2))))
$$;

-- The member asks. Returns nothing the member could use to vouch for themselves: the raw link token
-- is made and kept by the server, which passes in only its hash and emails the link.
create or replace function public.request_vouch(p_milestone text, p_email text, p_relationship text, p_token_hash text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  m public.milestones;
  addr text := lower(btrim(coalesce(p_email, '')));
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into m from public.milestones where id = p_milestone for update;
  if m.id is null or m.owner_id <> auth.uid() then raise exception 'You can only ask about your own milestones.' using errcode = '42501'; end if;
  if m.status not in ('draft', 'pending') then raise exception 'This milestone isn''t waiting for proof.' using errcode = 'P0001'; end if;
  if m.evidence = '' and jsonb_array_length(m.evidence_items) = 0 then
    raise exception 'Add evidence first, so they can see what they''re vouching for.' using errcode = 'P0001';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'That link isn''t valid.' using errcode = 'P0001'; end if;
  if p_relationship not in ('professor', 'ta', 'pi', 'manager', 'mentor', 'other') then raise exception 'Pick how they know your work.' using errcode = 'P0001'; end if;
  if not public.vouch_email_ok(addr) then
    raise exception 'Use their university or company address (not Gmail, Outlook and the like), so the vouch means something.' using errcode = 'P0001';
  end if;
  -- Never yourself, and never anyone on the project's team.
  if exists (select 1 from auth.users u where lower(u.email) = addr
             and (u.id = auth.uid() or public.on_project_team(m.project_id, u.id))) then
    raise exception 'Ask someone who isn''t on the project.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.milestone_vouches where milestone_id = m.id and state = 'asked' and expires_at > now()) >= 3 then
    raise exception 'You''ve asked 3 people about this one already. Wait for them to answer.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.milestone_vouches where milestone_id = m.id and lower(email) = addr and state = 'asked' and expires_at > now()) then
    raise exception 'You''ve already asked them about this one.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.milestone_vouches where requested_by = auth.uid() and created_at > now() - interval '7 days') >= 10 then
    raise exception 'You''ve sent 10 asks this week. Try again in a few days.' using errcode = 'P0001';
  end if;
  insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash)
  values (m.id, auth.uid(), addr, p_relationship, p_token_hash) returning id into new_id;
  if m.status = 'draft' then update public.milestones set status = 'pending' where id = m.id; end if;
  insert into public.verification_events (milestone_id, community_id, actor_id, actor_role, action, note)
  values (m.id, m.community_id, auth.uid(), 'member', 'vouch_requested', p_relationship || ' at ' || split_part(addr, '@', 2));
  return new_id;
end $$;

-- What the person with the link sees: the milestone, its evidence, whose it is. Nothing if the link is
-- unknown, used or expired.
create or replace function public.vouch_preview(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.milestone_vouches; m public.milestones; p public.profiles; pr public.projects;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into v from public.milestone_vouches where token_hash = p_token_hash;
  if v.id is null then return null; end if;
  select * into m from public.milestones where id = v.milestone_id;
  select * into p from public.profiles where id = v.requested_by;
  select * into pr from public.projects where id = m.project_id;
  return jsonb_build_object(
    'state', case when v.state = 'asked' and v.expires_at <= now() then 'expired' else v.state end,
    'email', v.email, 'relationship', v.relationship,
    'member', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    'project', coalesce(pr.title, ''),
    'title', m.title, 'detail', m.detail, 'evidence', m.evidence, 'evidence_items', m.evidence_items,
    'achieved_on', m.achieved_on, 'expires_at', v.expires_at);
end $$;

-- The answer. Vouching makes the milestone verified, with the voucher named on it.
create or replace function public.answer_vouch(p_token_hash text, p_vouch boolean, p_name text, p_title text, p_saw text, p_knows_from text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v public.milestone_vouches;
  m public.milestones;
  nm text := btrim(coalesce(p_name, ''));
  tt text := btrim(coalesce(p_title, ''));
  sw text := btrim(coalesce(p_saw, ''));
  kf text := btrim(coalesce(p_knows_from, ''));
  label text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'That link isn''t valid.' using errcode = 'P0001'; end if;
  select * into v from public.milestone_vouches where token_hash = p_token_hash for update;
  if v.id is null then raise exception 'That link isn''t valid.' using errcode = 'P0001'; end if;
  if v.state <> 'asked' then raise exception 'This link has already been used.' using errcode = 'P0001'; end if;
  if v.expires_at <= now() then
    update public.milestone_vouches set state = 'expired' where id = v.id;
    raise exception 'This link has expired. Ask them to send a new one.' using errcode = 'P0001';
  end if;
  select * into m from public.milestones where id = v.milestone_id for update;
  if m.id is null then raise exception 'That milestone no longer exists.' using errcode = 'P0001'; end if;

  if not p_vouch then
    update public.milestone_vouches set state = 'declined', answered_at = now() where id = v.id;
    insert into public.verification_events (milestone_id, community_id, actor_id, actor_role, action, note)
    values (m.id, m.community_id, null, v.relationship, 'vouch_declined', split_part(v.email, '@', 2));
    -- notify() needs an actor with an account; a voucher may have none, so the note goes in directly.
    insert into public.notifications (user_id, actor_id, actor_first, actor_last, kind, community_id, community_name, snippet)
    values (m.owner_id, null, 'Someone at ' || split_part(v.email, '@', 2), '', 'milestone_declined', m.community_id, '', left(m.title, 140));
    return 'declined';
  end if;

  if char_length(nm) not between 2 and 80 or nm ~ '[<>]' then raise exception 'Add your name.' using errcode = 'P0001'; end if;
  if char_length(tt) > 80 or tt ~ '[<>]' then raise exception 'Keep your role short.' using errcode = 'P0001'; end if;
  if char_length(sw) not between 20 and 600 then raise exception 'Say what you saw them do, in a sentence or two.' using errcode = 'P0001'; end if;
  if char_length(kf) not between 3 and 300 then raise exception 'Say how you know their work.' using errcode = 'P0001'; end if;
  if m.status not in ('draft', 'pending') then raise exception 'This milestone isn''t waiting for proof any more.' using errcode = 'P0001'; end if;
  if (select count(*) from public.milestone_vouches where lower(email) = lower(v.email) and state = 'vouched' and answered_at > now() - interval '30 days') >= 8 then
    raise exception 'This address has vouched 8 times this month, which is the limit.' using errcode = 'P0001';
  end if;

  label := nm || case when tt <> '' then ', ' || tt else '' end || ' · ' || split_part(v.email, '@', 2);
  update public.milestone_vouches set state = 'vouched', voucher_name = nm, voucher_title = tt, saw = sw, knows_from = kf, answered_at = now() where id = v.id;
  update public.milestone_vouches set state = 'withdrawn' where milestone_id = m.id and id <> v.id and state = 'asked';
  update public.milestones set status = 'verified', reviewer_id = null, reviewer_name = nm, reviewer_role = v.relationship,
    vouched_by = label, review_note = left(sw, 300), reviewed_at = now() where id = m.id;
  insert into public.verification_events (milestone_id, community_id, actor_id, actor_role, action, note)
  values (m.id, m.community_id, null, v.relationship, 'vouched', label);
  insert into public.notifications (user_id, actor_id, actor_first, actor_last, kind, community_id, community_name, snippet)
  values (m.owner_id, null, nm, '', 'milestone_verified', m.community_id, '', left(m.title, 140));
  return 'vouched';
end $$;

-- The insert trigger copies the club's name and settings; with no club there's nothing to copy.
create or replace function public.milestones_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.owner_id := auth.uid();
  new.community_name := coalesce((select name from public.communities where id = new.community_id), '');
  new.reviewer_id := null; new.reviewer_name := ''; new.reviewer_role := ''; new.review_note := ''; new.reviewed_at := null;
  new.revoked_reason := ''; new.dispute_note := ''; new.escalated := false; new.vouched_by := '';
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

create or replace function public.vouches_ready() returns boolean language sql stable as $$ select true $$;

revoke execute on function public.vouch_email_ok(text) from public;
revoke execute on function public.request_vouch(text, text, text, text) from public;
revoke execute on function public.vouch_preview(text) from public;
revoke execute on function public.answer_vouch(text, boolean, text, text, text, text) from public;
grant execute on function public.vouch_email_ok(text) to authenticated;
grant execute on function public.request_vouch(text, text, text, text) to authenticated;
grant execute on function public.vouch_preview(text) to anon, authenticated;
grant execute on function public.answer_vouch(text, boolean, text, text, text, text) to anon, authenticated;
grant execute on function public.vouches_ready() to anon, authenticated;
