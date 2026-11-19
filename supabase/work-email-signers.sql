-- Step 83: a work email can sign (founders, 2026-11-19, for the Product Hunt launch). Run after
-- signer-tools.sql and redacted-proof.sql. Additive and safe to re-run.
--
-- Until now a signer needed a university address or an address at a company already verified on
-- Brazework (vouches.sql). That left someone who works with nobody to ask: their tech lead or manager
-- is at their own company, which almost never is verified here yet. Now any work address can sign,
-- as long as it isn't free mail (Gmail, Outlook and the like) or a throwaway inbox.
--
-- Trust stays honest, because the signature says which kind it is:
--   school   a university address                      "Dr. Ruiz, Assistant Professor · stateu.edu"
--   company  a company verified on Brazework           "Sam Rivera, Staff Engineer · acme.com"
--   work     any other work address                    "Sam Rivera, Staff Engineer · northwind.com (company not verified)"
-- The words are written into the signature when it's given (milestones.vouched_by), so every place a
-- signature shows (the record, share cards, review packets, Find builders, assistants) says it, and
-- a company reading it can weigh it. It records what was true that day: if the company is verified
-- later, earlier signatures keep their words.
--
-- Every other guard in vouches.sql still holds: the link proves the signer controls that inbox, never
-- the member's own address or anyone on the project, 3 asks a milestone, 10 a week, 8 signatures a
-- month per address, and each one names who signed and what they saw.

-- Free mail and throwaway inboxes: never a signer's address. A table, so a founder can add one
-- without a deploy. Whole domains; the well-known families (outlook.*, yahoo.*, …) are matched by
-- name in free_mail() below.
create table if not exists public.free_mail_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);
alter table public.free_mail_domains enable row level security;
revoke all on public.free_mail_domains from anon, authenticated;
insert into public.free_mail_domains (domain) values
  ('gmail.com'), ('googlemail.com'), ('icloud.com'), ('me.com'), ('mac.com'), ('aol.com'), ('msn.com'),
  ('proton.me'), ('pm.me'), ('mail.com'), ('email.com'), ('zoho.com'), ('hey.com'), ('duck.com'),
  ('fastmail.com'), ('fastmail.fm'), ('tutanota.com'), ('tuta.io'), ('tutamail.com'), ('hushmail.com'),
  ('qq.com'), ('163.com'), ('126.com'), ('sina.com'), ('naver.com'), ('daum.net'), ('rediffmail.com'),
  ('mail.ru'), ('web.de'), ('t-online.de'), ('orange.fr'), ('free.fr'), ('laposte.net'), ('libero.it'),
  ('comcast.net'), ('att.net'), ('verizon.net'), ('sbcglobal.net'), ('cox.net'), ('charter.net'),
  ('btinternet.com'), ('sky.com'), ('shaw.ca'), ('rogers.com'), ('bigpond.com'),
  ('mailinator.com'), ('guerrillamail.com'), ('sharklasers.com'), ('10minutemail.com'), ('tempmail.com'),
  ('temp-mail.org'), ('yopmail.com'), ('trashmail.com'), ('getnada.com'), ('dispostable.com'),
  ('maildrop.cc'), ('throwawaymail.com'), ('fakeinbox.com'), ('mintemail.com'), ('moakt.com')
on conflict (domain) do nothing;

-- Is this domain free mail or a throwaway inbox? Listed domains and their subdomains, plus the
-- families that run under many country endings (outlook.fr, yahoo.co.uk, gmx.de, …).
create or replace function public.free_mail(p_domain text) returns boolean
language sql stable security definer set search_path = public as $$
  with h as (select lower(btrim(coalesce(p_domain, ''))) as host)
  select h.host ~ '^(gmail|googlemail|outlook|hotmail|live|yahoo|ymail|rocketmail|gmx|yandex|protonmail|icloud|aol)\.[a-z.]{2,10}$'
      or exists (select 1 from public.free_mail_domains d where h.host = d.domain or right(h.host, char_length(d.domain) + 1) = '.' || d.domain)
  from h
$$;

-- Which kind of address a signer's is: 'school', 'company' (verified on Brazework), 'work' (any
-- other work address), or '' (free mail, a throwaway inbox, or not an address): '' can't sign.
create or replace function public.vouch_email_kind(p_email text) returns text
language sql stable security definer set search_path = public as $$
  with a as (select lower(btrim(coalesce(p_email, ''))) as addr), h as (select addr, split_part(addr, '@', 2) as host from a)
  select case
    when h.addr !~ '^[^@\s]+@[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' or h.host ~ '\.\.' then ''
    when public.is_school_email(h.addr) then 'school'
    when exists (select 1 from public.organizations o where o.type = 'company' and o.verification_status = 'verified' and lower(o.domain) = h.host) then 'company'
    when public.free_mail(h.host) then ''
    else 'work' end
  from h
$$;

-- request_vouch()'s check (vouches.sql), and the app's before it uses up a draft (lib/tool-drafts.ts).
create or replace function public.vouch_email_ok(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vouch_email_kind(p_email) <> ''
$$;

-- A signature, as in signer-tools.sql, with one change: a work address at a company that isn't
-- verified here says so in the signature itself. The label stays within vouched_by's 160 characters
-- by shortening the name and role, never the domain or those words.
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

  tail := ' · ' || split_part(v.email, '@', 2) || case when public.vouch_email_kind(v.email) = 'work' then ' (company not verified)' else '' end;
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

create or replace function public.work_email_signers_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

-- Supabase grants new functions to anon and authenticated by name, so each is revoked by name.
revoke execute on function public.free_mail(text) from public, anon, authenticated;
revoke execute on function public.vouch_email_kind(text), public.vouch_email_ok(text) from public, anon;
revoke execute on function public.answer_vouch_row(bigint, boolean, text, text, text, text) from anon, authenticated, public;
grant execute on function public.vouch_email_ok(text), public.vouch_email_kind(text), public.work_email_signers_ready() to authenticated;

-- A private milestone's public line (redacted-proof.sql) says who stood behind it in general terms.
-- It never claimed a domain; now it also never calls a company verified when it wasn't: 'work' is a
-- signature given from a work address at a company that wasn't verified here that day.
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
revoke execute on function public.redacted_proof(uuid) from anon, public;
grant execute on function public.redacted_proof(uuid) to authenticated;
