-- Step 68: making signing worthwhile for signers. Run after mcp-workflows.sql. Additive and safe to
-- re-run. Every rule in vouches.sql and mcp-workflows.sql (mcp_request_vouch) still applies: this step
-- changes how a signer reaches the asks and sees their own record, never what an ask or a vouch needs.
--
-- 1. One reminder, 3 days after the ask, then never again. The first link's token exists only in the
--    first email (the database keeps its sha256), so the reminder carries a second link: its hash goes
--    in reminder_hash, and either link opens the same single-use ask. reminded_at is set once and never
--    cleared after a send, so nobody gets a second reminder. A send that fails hands the claim back.
-- 2. Sign several in one go. Holding one live link proves you control that address, so the vouch page
--    shows the other asks waiting for the same address (vouch_inbox) and answers several at once
--    (answer_vouches). Each answer goes through answer_vouch_row(), which is answer_vouch()'s body
--    unchanged: each needs its own "what you saw", the 8-a-month limit per address holds, and a
--    refused one doesn't stop the rest. A link stays good for this for a day after it's used.
-- 3. What you've signed (my_signatures): for a signed-in account, every vouch sent from its confirmed
--    email, every milestone it verified as a club officer, and every Pro sign-off, with what they
--    wrote. For recommendation letters and reviews. A milestone its owner has since made private shows
--    only the signer's own words, not its title.

-- ---------- 1. The reminder's link ----------
alter table public.milestone_vouches add column if not exists reminded_at timestamptz;
alter table public.milestone_vouches add column if not exists reminder_hash text;
alter table public.milestone_vouches drop constraint if exists milestone_vouches_reminder_hash_ok;
alter table public.milestone_vouches add constraint milestone_vouches_reminder_hash_ok check (reminder_hash is null or reminder_hash ~ '^[0-9a-f]{64}$');
create unique index if not exists milestone_vouches_reminder_hash on public.milestone_vouches (reminder_hash) where reminder_hash is not null;

-- The ask behind a link: the first email's or the reminder's.
create or replace function public.vouch_by_hash(p_hash text) returns public.milestone_vouches
language sql stable security definer set search_path = public as $$
  select * from public.milestone_vouches
  where coalesce(p_hash, '') ~ '^[0-9a-f]{64}$' and (token_hash = p_hash or reminder_hash = p_hash)
  limit 1
$$;
revoke execute on function public.vouch_by_hash(text) from anon, authenticated, public;

-- As in vouches.sql, opened by either link.
create or replace function public.vouch_preview(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.milestone_vouches := public.vouch_by_hash(p_token_hash); m public.milestones; p public.profiles; pr public.projects;
begin
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

-- answer_vouch()'s body from vouches.sql, unchanged, for one ask by id. Only the functions below call it.
create or replace function public.answer_vouch_row(p_id bigint, p_vouch boolean, p_name text, p_title text, p_saw text, p_knows_from text) returns text
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
  select * into v from public.milestone_vouches where id = p_id for update;
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
revoke execute on function public.answer_vouch_row(bigint, boolean, text, text, text, text) from anon, authenticated, public;

-- The same answer as before, by either link.
create or replace function public.answer_vouch(p_token_hash text, p_vouch boolean, p_name text, p_title text, p_saw text, p_knows_from text) returns text
language plpgsql security definer set search_path = public as $$
declare v public.milestone_vouches := public.vouch_by_hash(p_token_hash);
begin
  if v.id is null then raise exception 'That link isn''t valid.' using errcode = 'P0001'; end if;
  return public.answer_vouch_row(v.id, p_vouch, p_name, p_title, p_saw, p_knows_from);
end $$;

-- Asks due a reminder: still open 3 days on, at least a day left, never reminded. Service role only.
create or replace function public.vouch_reminders_due(p_limit int default 200)
returns table (id bigint, email text, relationship text, member text, title text, project text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.id, v.email, v.relationship, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), m.title, coalesce(pr.title, ''), v.expires_at
  from public.milestone_vouches v
  join public.milestones m on m.id = v.milestone_id
  join public.profiles p on p.id = v.requested_by
  left join public.projects pr on pr.id = m.project_id
  where v.state = 'asked' and v.reminded_at is null and v.created_at <= now() - interval '3 days'
    and v.expires_at > now() + interval '1 day' and m.status in ('draft', 'pending')
  order by v.id limit least(greatest(p_limit, 1), 500)
$$;
-- Claim one reminder with its link's hash (true when this run owns it); a failed send hands it back.
create or replace function public.claim_vouch_reminder(p_id bigint, p_reminder_hash text) returns boolean
language plpgsql security definer set search_path = public as $$
declare claimed boolean := false;
begin
  if coalesce(p_reminder_hash, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.milestone_vouches set reminded_at = now(), reminder_hash = p_reminder_hash
   where id = p_id and reminded_at is null and state = 'asked' and expires_at > now()
  returning true into claimed;
  return coalesce(claimed, false);
end $$;
create or replace function public.release_vouch_reminder(p_id bigint, p_reminder_hash text) returns void
language sql security definer set search_path = public as $$
  update public.milestone_vouches set reminded_at = null, reminder_hash = null where id = p_id and reminder_hash = p_reminder_hash
$$;
revoke execute on function public.vouch_reminders_due(int), public.claim_vouch_reminder(bigint, text), public.release_vouch_reminder(bigint, text) from anon, authenticated, public;
grant execute on function public.vouch_reminders_due(int), public.claim_vouch_reminder(bigint, text), public.release_vouch_reminder(bigint, text) to service_role;

-- ---------- 2. Several at once ----------
-- A link that's live, or was answered in the last day, shows the other asks to the same address.
create or replace function public.vouch_link_open(v public.milestone_vouches) returns boolean
language sql stable set search_path = public as $$
  select v.id is not null and ((v.state = 'asked' and v.expires_at > now()) or (v.state in ('vouched', 'declined') and v.answered_at > now() - interval '1 day'))
$$;
revoke execute on function public.vouch_link_open(public.milestone_vouches) from anon, authenticated, public;

create or replace function public.vouch_inbox(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.milestone_vouches := public.vouch_by_hash(p_token_hash);
begin
  if not public.vouch_link_open(v) then return '[]'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'relationship', w.relationship, 'expires_at', w.expires_at,
      'member', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), 'project', coalesce(pr.title, ''),
      'title', m.title, 'detail', m.detail, 'achieved_on', m.achieved_on,
      'links', (select coalesce(jsonb_agg(u), '[]') from (select m.evidence as u where m.evidence ~ '^https://'
                 union all select e->>'url' from jsonb_array_elements(m.evidence_items) e where e->>'url' ~ '^https://') l))
      order by w.created_at)
    from public.milestone_vouches w
    join public.milestones m on m.id = w.milestone_id
    join public.profiles p on p.id = w.requested_by
    left join public.projects pr on pr.id = m.project_id
    where lower(w.email) = lower(v.email) and w.id <> v.id and w.state = 'asked' and w.expires_at > now()
      and m.status in ('draft', 'pending')), '[]');
end $$;

-- Answer several: one name and role, and for each ask its own "what you saw" and "how you know their
-- work" (or a decline). Returns one result per ask; a refused one is reported and the rest go ahead.
create or replace function public.answer_vouches(p_token_hash text, p_name text, p_title text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.milestone_vouches := public.vouch_by_hash(p_token_hash); it jsonb; w public.milestone_vouches; r text; res jsonb := '[]'; wid bigint;
begin
  if v.id is null then raise exception 'That link isn''t valid.' using errcode = 'P0001'; end if;
  if not public.vouch_link_open(v) then raise exception 'This link has expired. Ask them to send a new one.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Pick between 1 and 20 to answer.' using errcode = 'P0001';
  end if;
  for it in select value from jsonb_array_elements(p_items) loop
    wid := case when coalesce(it->>'id', '') ~ '^[0-9]{1,18}$' then (it->>'id')::bigint end;
    select * into w from public.milestone_vouches where id = wid;
    if w.id is null or lower(w.email) <> lower(v.email) then
      res := res || jsonb_build_object('id', it->'id', 'ok', false, 'message', 'That ask wasn''t sent to you.');
      continue;
    end if;
    begin
      r := public.answer_vouch_row(w.id, coalesce((it->>'vouch')::boolean, true), p_name, p_title, it->>'saw', it->>'knows_from');
      res := res || jsonb_build_object('id', w.id, 'ok', true, 'result', r);
    exception when sqlstate 'P0001' then
      res := res || jsonb_build_object('id', w.id, 'ok', false, 'message', sqlerrm);
    end;
  end loop;
  return res;
end $$;

revoke execute on function public.vouch_inbox(text), public.answer_vouches(text, text, text, jsonb) from public;
grant execute on function public.vouch_inbox(text), public.answer_vouches(text, text, text, jsonb) to anon, authenticated;

-- ---------- 3. What you've signed ----------
create or replace function public.my_signatures() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); addr text;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  select lower(u.email) into addr from auth.users u where u.id = me and u.email_confirmed_at is not null;
  return coalesce((select jsonb_agg(s order by s->>'at' desc) from (
    -- Vouches sent from this account's confirmed address.
    select jsonb_build_object('kind', 'vouch', 'milestone', m.id, 'at', v.answered_at, 'role', v.relationship,
      'member', jsonb_build_object('id', o.id, 'first', o.first_name, 'last', o.last_name),
      'title', case when m.private or pr.private then '' else m.title end, 'project', case when m.private or pr.private then '' else pr.title end,
      'private', m.private or pr.private, 'status', m.status, 'wrote', v.saw, 'how', v.knows_from) as s
    from public.milestone_vouches v
    join public.milestones m on m.id = v.milestone_id
    join public.profiles o on o.id = m.owner_id
    join public.projects pr on pr.id = m.project_id
    where addr is not null and lower(v.email) = addr and v.state = 'vouched'
    union all
    -- Milestones this account verified for a club.
    select jsonb_build_object('kind', 'club', 'milestone', m.id, 'at', m.reviewed_at, 'role', m.reviewer_role, 'club', m.community_name,
      'member', jsonb_build_object('id', o.id, 'first', o.first_name, 'last', o.last_name),
      'title', case when m.private or pr.private then '' else m.title end, 'project', case when m.private or pr.private then '' else pr.title end,
      'private', m.private or pr.private, 'status', m.status, 'wrote', m.review_note, 'how', '')
    from public.milestones m
    join public.profiles o on o.id = m.owner_id
    join public.projects pr on pr.id = m.project_id
    where m.reviewer_id = me and m.reviewed_at is not null and m.status in ('verified', 'revoked', 'disputed')
    union all
    -- Pro sign-offs.
    select jsonb_build_object('kind', 'pro', 'milestone', m.id, 'at', r.created_at, 'role', r.reviewer_title, 'club', r.employer_name,
      'member', jsonb_build_object('id', o.id, 'first', o.first_name, 'last', o.last_name),
      'title', case when m.private or pr.private then '' else m.title end, 'project', case when m.private or pr.private then '' else pr.title end,
      'private', m.private or pr.private, 'status', m.status, 'wrote', r.note, 'how', '')
    from public.pro_reviews r
    join public.milestones m on m.id = r.milestone_id
    join public.profiles o on o.id = m.owner_id
    join public.projects pr on pr.id = m.project_id
    where r.reviewer = me
  ) x), '[]');
end $$;
revoke execute on function public.my_signatures() from anon, public;
grant execute on function public.my_signatures() to authenticated;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.signer_tools_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.signer_tools_ready() to authenticated;
