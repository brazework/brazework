-- Step 86: a personal address can sign, and the signature says so (founders, 2026-11-21, before the
-- Product Hunt launch). Run after linkedin-required.sql. Additive and safe to re-run.
--
-- "Someone who saw it" refused free mail (Gmail, Outlook, iCloud and the like; work-email-signers.sql),
-- which left out people whose only address is personal: a mentor between jobs, a club alumnus, a
-- freelancer, a family friend who taught them to weld. Now they can sign, and the signature carries a
-- fourth label, so a company reading the record can weigh it:
--   school    a university address                 "Dr. Ruiz, Assistant Professor · stateu.edu"
--   company   a company verified on Brazework      "Sam Rivera, Staff Engineer · acme.com"
--   work      any other work address               "Sam Rivera · northwind.com (company not verified)"
--   personal  free mail                            "Sam Rivera · gmail.com (personal email)"
-- Throwaway inboxes (Mailinator, 10-minute mail and the like) still can't sign: they exist to be
-- discarded. Every other guard holds: the link proves the signer controls the inbox, never the member
-- or anyone on the project, 3 asks a milestone, 10 a week, 8 signatures a month per address.

-- ---------- Throwaway inboxes: never a signer ----------
-- Their own list now (free_mail_domains keeps both, as before, for free_mail()). Members can't read it.
create table if not exists public.throwaway_mail_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);
alter table public.throwaway_mail_domains enable row level security;
revoke all on public.throwaway_mail_domains from anon, authenticated;
insert into public.throwaway_mail_domains (domain) values
  ('mailinator.com'), ('guerrillamail.com'), ('sharklasers.com'), ('10minutemail.com'), ('tempmail.com'),
  ('temp-mail.org'), ('yopmail.com'), ('trashmail.com'), ('getnada.com'), ('dispostable.com'),
  ('maildrop.cc'), ('throwawaymail.com'), ('fakeinbox.com'), ('mintemail.com'), ('moakt.com')
on conflict (domain) do nothing;

create or replace function public.throwaway_mail(p_domain text) returns boolean
language sql stable security definer set search_path = public as $$
  with h as (select lower(btrim(coalesce(p_domain, ''))) as host)
  select exists (select 1 from public.throwaway_mail_domains d where h.host = d.domain or right(h.host, char_length(d.domain) + 1) = '.' || d.domain)
  from h
$$;

-- Which kind of address a signer's is: 'school', 'company', 'work', 'personal', or '' (a throwaway
-- inbox, or not an address): '' can't sign.
create or replace function public.vouch_email_kind(p_email text) returns text
language sql stable security definer set search_path = public as $$
  with a as (select lower(btrim(coalesce(p_email, ''))) as addr), h as (select addr, split_part(addr, '@', 2) as host from a)
  select case
    when h.addr !~ '^[^@\s]+@[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' or h.host ~ '\.\.' then ''
    when public.throwaway_mail(h.host) then ''
    when public.is_school_email(h.addr) then 'school'
    when exists (select 1 from public.organizations o where o.type = 'company' and o.verification_status = 'verified' and lower(o.domain) = h.host) then 'company'
    when public.free_mail(h.host) then 'personal'
    else 'work' end
  from h
$$;

-- The ask's check follows the kind (unchanged: anything but '' can be asked).
create or replace function public.vouch_email_ok(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vouch_email_kind(p_email) <> ''
$$;

-- The ask, as in vouches.sql, with the refusal's words changed: only a throwaway inbox (or something
-- that isn't an address) is refused now.
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
    raise exception 'Use the email they really use: a throwaway inbox can''t sign.' using errcode = 'P0001';
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

-- A signature, as in work-email-signers.sql, with one change: a personal address says so in the
-- signature itself, as an unverified company's work address already does.
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
  tail text;
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

  tail := ' · ' || split_part(v.email, '@', 2) || case public.vouch_email_kind(v.email)
    when 'work' then ' (company not verified)'
    when 'personal' then ' (personal email)'
    else '' end;
  label := left(left(nm || case when tt <> '' then ', ' || tt else '' end, greatest(2, 160 - char_length(tail))) || tail, 160);
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

-- A private milestone's public line (redacted-proof.sql), as in work-email-signers.sql, plus
-- 'personal': a signature from a personal address is never called a company's.
create or replace function public.redacted_proof(p_member uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'line', m.public_line,
      'month', to_char(coalesce(m.reviewed_at, m.achieved_on::timestamptz), 'YYYY-MM'),
      'signer', case
        when m.vouched_by <> '' then jsonb_build_object('kind', 'vouch', 'role', m.reviewer_role,
          'org', case when public.is_school_email((select v.email from public.milestone_vouches v where v.milestone_id = m.id and v.state = 'vouched' order by v.answered_at desc limit 1))
                      then 'university'
                      when m.vouched_by like '% (personal email)' then 'personal'
                      when m.vouched_by like '% (company not verified)' then 'work'
                      else 'company' end)
        else jsonb_build_object('kind', 'club') end,
      'pro', exists (select 1 from public.pro_reviews r where r.milestone_id = m.id))
    order by coalesce(m.reviewed_at, m.achieved_on::timestamptz) desc), '[]')
  from public.milestones m
  join public.projects p on p.id = m.project_id
  where auth.uid() is not null and public.is_member()
    and m.owner_id = p_member and m.public_line <> '' and m.status = 'verified' and (m.private or p.private)
$$;

create or replace function public.personal_email_signers_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

-- Supabase grants new functions to anon and authenticated by name, so each is revoked by name.
revoke execute on function public.throwaway_mail(text) from public, anon, authenticated;
revoke execute on function public.vouch_email_kind(text), public.vouch_email_ok(text) from public, anon;
revoke execute on function public.request_vouch(text, text, text, text) from public, anon;
revoke execute on function public.answer_vouch_row(bigint, boolean, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.redacted_proof(uuid) from anon, public;
grant execute on function public.vouch_email_ok(text), public.vouch_email_kind(text), public.request_vouch(text, text, text, text),
  public.redacted_proof(uuid), public.personal_email_signers_ready() to authenticated;
