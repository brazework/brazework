-- Study groups: a club for one course and one term ("CHEM 201 · Spring 2027 · Tuesdays 7pm, Library 3"),
-- and proof for the people who lead them. Run after hardening.sql. Additive; safe to run again.
--
-- 1. Communities of type 'study' (already a type since schema.sql) get a course, a term and when they
--    meet. Other types leave them empty. The club's admins edit them like the rest of the club.
-- 2. Members confirm who led the group's sessions. Each confirmation is one member vouching for one
--    other member; "Led the CHEM 201 study group, confirmed by 4 members" then shows on the leader's
--    profile as proof. You can't confirm yourself, both of you must be members, and a confirmation can
--    be taken back.
--
-- Who writes: the club's admins (course, term, meets, through the column grant below and schema.sql's
-- update policy), and confirm_study_lead / unconfirm_study_lead for confirmations. Nobody writes the
-- confirmations table directly.

-- 1. Course, term and meeting time.
alter table public.communities add column if not exists course text not null default '' check (char_length(course) <= 20 and course !~ '[<>]');
alter table public.communities add column if not exists term text not null default '' check (char_length(term) <= 24 and term !~ '[<>]');
alter table public.communities add column if not exists meets text not null default '' check (char_length(meets) <= 80 and meets !~ '[<>]');
grant update (course, term, meets) on public.communities to authenticated;
create index if not exists communities_course_idx on public.communities (lower(course)) where type = 'study';

-- 2. Who led it, as the members saw it.
create table if not exists public.study_leads (
  community_id text not null references public.communities (id) on delete cascade,
  leader uuid not null references public.profiles (id) on delete cascade,
  confirmed_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, leader, confirmed_by),
  check (leader <> confirmed_by)
);
create index if not exists study_leads_leader_idx on public.study_leads (leader);
create index if not exists study_leads_confirmed_by_idx on public.study_leads (confirmed_by, created_at);
alter table public.study_leads enable row level security;
revoke all on public.study_leads from anon, authenticated;
grant select on public.study_leads to authenticated;
-- Proof is meant to be seen: anyone signed in can see who confirmed whom, as with verified milestones.
drop policy if exists "study leads are public to members" on public.study_leads;
create policy "study leads are public to members" on public.study_leads for select to authenticated using (true);

create or replace function public.confirm_study_lead(p_cid text, p_leader uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = p_cid and type = 'study') then
    raise exception 'That isn''t a study group.' using errcode = 'P0001';
  end if;
  if p_leader = me then raise exception 'Someone else in the group has to confirm you led it.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.community_members where community_id = p_cid and uid = me) then
    raise exception 'Join the group to confirm who led it.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_members where community_id = p_cid and uid = p_leader) then
    raise exception 'They aren''t in this group.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.study_leads where confirmed_by = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of confirmations today. Try again tomorrow.' using errcode = 'P0001';
  end if;
  insert into public.study_leads (community_id, leader, confirmed_by) values (p_cid, p_leader, me) on conflict do nothing;
end $$;

create or replace function public.unconfirm_study_lead(p_cid text, p_leader uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from public.study_leads where community_id = p_cid and leader = p_leader and confirmed_by = auth.uid();
end $$;

create or replace function public.study_groups_ready() returns boolean language sql stable set search_path = public as $$ select true $$;

revoke execute on function public.confirm_study_lead(text, uuid), public.unconfirm_study_lead(text, uuid) from public, anon;
grant execute on function public.confirm_study_lead(text, uuid), public.unconfirm_study_lead(text, uuid) to authenticated, service_role;
grant execute on function public.study_groups_ready() to anon, authenticated;
