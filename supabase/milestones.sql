-- Club-verified milestones: the proof in "built by clubs, proven by work".
-- A member adds a milestone to one of their projects and asks one of their clubs to vouch for it;
-- the club's moderators and up verify or decline it. Run after copilot.sql. Additive only.
--
-- Rules the database enforces (not just the app):
-- - only the project's owner can add milestones to it, and only for a club they belong to
-- - nobody can set the status directly; it changes only through review_milestone()
-- - you can't verify your own milestone, even as the club's owner
-- - pending and declined milestones are visible only to their owner and that club's moderators+

create table public.milestones (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  community_name text not null default '',
  title text not null check (char_length(btrim(title)) between 1 and 120),
  detail text not null default '' check (char_length(detail) <= 600),
  evidence text not null default '' check (evidence = '' or (char_length(evidence) <= 300 and evidence ~ '^https?://[^\s]+$')),
  achieved_on date not null default current_date check (achieved_on between date '2000-01-01' and current_date + 1),
  status text not null default 'pending' check (status in ('pending', 'verified', 'declined')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_name text not null default '',
  review_note text not null default '' check (char_length(review_note) <= 300),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id);
create index milestones_queue_idx on public.milestones (community_id, status, created_at);
create index milestones_owner_idx on public.milestones (owner_id);
alter table public.milestones enable row level security;

create policy "read milestones" on public.milestones for select to authenticated
  using (status = 'verified' or owner_id = auth.uid() or public.my_rank(community_id) >= 3);
create policy "ask your club to verify" on public.milestones for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    and public.my_rank(community_id) > 0
  );
create policy "remove your milestones" on public.milestones for delete to authenticated
  using (owner_id = auth.uid());

-- Clients may only fill in these columns; status and review fields keep their defaults.
revoke all on table public.milestones from anon, authenticated;
grant select, delete on public.milestones to authenticated;
grant insert (project_id, community_id, title, detail, evidence, achieved_on) on public.milestones to authenticated;

-- On a new request: copy the club's name, cap open requests, and tell the club's moderators+.
create function public.milestones_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.title := btrim(new.title);
  new.community_name := coalesce((select name from public.communities where id = new.community_id), '');
  if (select count(*) from public.milestones where owner_id = new.owner_id and status = 'pending') >= 20 then
    raise exception 'You have 20 milestones waiting for review. Wait for your clubs to review some first.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger milestones_before_insert before insert on public.milestones
  for each row execute function public.milestones_before_insert();

create function public.milestones_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare officer uuid;
begin
  for officer in
    select uid from public.community_members
     where community_id = new.community_id and public.role_rank(role) >= 3 and uid <> new.owner_id
     limit 25
  loop
    perform public.notify(officer, new.owner_id, 'milestone_request', null, null, new.community_id, new.title);
  end loop;
  return new;
end $$;
create trigger milestones_after_insert after insert on public.milestones
  for each row execute function public.milestones_after_insert();

-- The only way a milestone's status changes. Moderators and up of the milestone's club,
-- never the milestone's owner. Returns the new status.
create function public.review_milestone(p_id text, p_verify boolean, p_note text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  m public.milestones;
  me public.profiles;
begin
  select * into m from public.milestones where id = p_id for update;
  if m.id is null then raise exception 'That milestone no longer exists.'; end if;
  if m.status <> 'pending' then raise exception 'That milestone has already been reviewed.'; end if;
  if m.owner_id = auth.uid() then raise exception 'You can''t verify your own milestone.'; end if;
  if public.my_rank(m.community_id) < 3 then raise exception 'Only the club''s moderators, admins and owner can review milestones.'; end if;
  select * into me from public.profiles where id = auth.uid();
  update public.milestones
     set status = case when p_verify then 'verified' else 'declined' end,
         reviewer_id = auth.uid(),
         reviewer_name = btrim(coalesce(me.first_name, '') || ' ' || left(coalesce(me.last_name, ''), 1) || case when coalesce(me.last_name, '') <> '' then '.' else '' end),
         review_note = left(btrim(coalesce(p_note, '')), 300),
         reviewed_at = now()
   where id = p_id;
  perform public.notify(m.owner_id, auth.uid(), case when p_verify then 'milestone_verified' else 'milestone_declined' end, null, null, m.community_id, m.title);
  return case when p_verify then 'verified' else 'declined' end;
end $$;

revoke execute on function public.review_milestone(text, boolean, text), public.milestones_before_insert(), public.milestones_after_insert() from anon, public;
grant execute on function public.review_milestone(text, boolean, text) to authenticated;

-- Notifications learn the three new kinds.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'like', 'comment', 'follow', 'connect_request', 'connect_accepted', 'community_request', 'community_approved',
  'milestone_request', 'milestone_verified', 'milestone_declined'));
