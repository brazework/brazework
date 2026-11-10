-- Sponsored build challenges: a verified company or school posts a brief and a prize, members enter
-- with a project they own, and the sponsor picks winners. This is how companies meet builders by
-- their work, and how Forge earns: a challenge goes live only once its sponsorship is paid (through
-- the billing provider) or a Forge admin marks it a pilot. Run after verification.sql. Additive.

-- ---------- Tables ----------
create table public.challenges (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  brief text not null check (char_length(brief) between 20 and 4000),
  prize text not null default '' check (char_length(prize) <= 200),
  topic text not null default '' check (char_length(topic) <= 60),
  deadline timestamptz not null,
  -- draft → open (accepting entries) → judging (after the deadline, or closed early) → closed (winners out)
  status text not null default 'draft' check (status in ('draft', 'open', 'judging', 'closed')),
  -- What lets it go live: 'paid' (set by the billing webhook) or 'pilot' (set by a Forge admin).
  sponsorship text not null default 'unpaid' check (sponsorship in ('unpaid', 'requested', 'paid', 'pilot')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index challenges_org_idx on public.challenges (org_id);
create index challenges_live_idx on public.challenges (deadline) where status in ('open', 'judging', 'closed');

create table public.challenge_entries (
  id bigint generated always as identity primary key,
  challenge_id text not null references public.challenges (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 1000),
  placement int check (placement between 1 and 3),
  created_at timestamptz not null default now(),
  unique (challenge_id, project_id)
);
create index challenge_entries_uid_idx on public.challenge_entries (uid);

-- Sponsorship requests and payments, one row per attempt. The billing provider fills provider_ref.
create table public.billing_requests (
  id bigint generated always as identity primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  challenge_id text references public.challenges (id) on delete set null,
  plan text not null check (plan in ('challenge', 'talent')),
  status text not null default 'requested' check (status in ('requested', 'checkout', 'paid', 'cancelled')),
  provider text not null default '' check (char_length(provider) <= 40),
  provider_ref text not null default '' check (char_length(provider_ref) <= 200),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index billing_requests_org_idx on public.billing_requests (org_id, created_at desc);

-- ---------- Who can do what ----------
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.billing_requests enable row level security;
revoke all on public.challenges, public.challenge_entries, public.billing_requests from anon, authenticated;

-- Everyone sees live challenges; a sponsor's admins also see their drafts.
grant select on public.challenges to authenticated;
create policy "read live challenges" on public.challenges for select to authenticated
  using (status <> 'draft' or public.is_org_admin(org_id) or public.is_forge_admin());
-- Sponsors write drafts only: going live and payment go through the functions below.
grant insert (org_id, title, brief, prize, topic, deadline) on public.challenges to authenticated;
create policy "sponsors create drafts" on public.challenges for insert to authenticated
  with check (public.is_org_admin(org_id) and status = 'draft' and sponsorship = 'unpaid'
    and exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'verified' and o.type in ('company', 'school')));
grant update (title, brief, prize, topic, deadline) on public.challenges to authenticated;
create policy "sponsors edit before judging" on public.challenges for update to authenticated
  using (public.is_org_admin(org_id) and status in ('draft', 'open'))
  with check (public.is_org_admin(org_id));
grant delete on public.challenges to authenticated;
create policy "sponsors delete drafts" on public.challenges for delete to authenticated
  using (public.is_org_admin(org_id) and status = 'draft');

-- Entrants see their own entries; sponsors see every entry; everyone sees the winners once closed.
grant select on public.challenge_entries to authenticated;
create policy "read entries" on public.challenge_entries for select to authenticated
  using (uid = auth.uid()
      or exists (select 1 from public.challenges c where c.id = challenge_id and (public.is_org_admin(c.org_id) or public.is_forge_admin()))
      or (placement is not null and exists (select 1 from public.challenges c where c.id = challenge_id and c.status = 'closed')));
-- Enter with a project you own, while the challenge is open and before its deadline.
grant insert (challenge_id, project_id, note) on public.challenge_entries to authenticated;
create policy "enter open challenges" on public.challenge_entries for insert to authenticated
  with check (uid = auth.uid() and placement is null
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.status = 'open' and c.deadline > now()));
grant delete on public.challenge_entries to authenticated;
create policy "withdraw while open" on public.challenge_entries for delete to authenticated
  using (uid = auth.uid() and placement is null
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.status = 'open'));

-- An entry is always the entrant's own.
create function public.challenge_entries_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  new.uid := auth.uid();
  new.placement := null;
  return new;
end $$;
create trigger challenge_entries_before_insert before insert on public.challenge_entries
  for each row execute function public.challenge_entries_before_insert();

-- A challenge records who created it.
create function public.challenges_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;
create trigger challenges_before_insert before insert on public.challenges
  for each row execute function public.challenges_before_insert();

grant select on public.billing_requests to authenticated;
create policy "sponsors read their billing" on public.billing_requests for select to authenticated
  using (public.is_org_admin(org_id) or public.is_forge_admin());

-- ---------- Going live, judging, paying ----------
-- Publish: only a paid or pilot sponsorship goes live, and only with a future deadline.
create function public.publish_challenge(p_id text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_id for update;
  if c.id is null or not public.is_org_admin(c.org_id) then raise exception 'Only the sponsor''s admins can publish this challenge.' using errcode = '42501'; end if;
  if c.status <> 'draft' then raise exception 'This challenge is already live.' using errcode = 'P0001'; end if;
  if c.sponsorship not in ('paid', 'pilot') then raise exception 'Sponsor the challenge first: it goes live once the sponsorship is paid or approved as a pilot.' using errcode = 'P0001'; end if;
  if c.deadline <= now() + interval '1 day' then raise exception 'Set a deadline at least a day away.' using errcode = 'P0001'; end if;
  update public.challenges set status = 'open' where id = p_id;
  return 'open';
end $$;

-- Ask Forge to sponsor it as a pilot (when online checkout isn't on), recorded for Forge admins.
create function public.request_sponsorship(p_id text, p_provider text default '', p_ref text default '') returns text
language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_id for update;
  if c.id is null or not public.is_org_admin(c.org_id) then raise exception 'Only the sponsor''s admins can do that.' using errcode = '42501'; end if;
  if c.sponsorship in ('paid', 'pilot') then return c.sponsorship; end if;
  insert into public.billing_requests (org_id, challenge_id, plan, status, provider, provider_ref, requested_by)
  values (c.org_id, c.id, 'challenge', case when p_ref <> '' then 'checkout' else 'requested' end, left(coalesce(p_provider, ''), 40), left(coalesce(p_ref, ''), 200), auth.uid());
  update public.challenges set sponsorship = 'requested' where id = p_id;
  return 'requested';
end $$;

-- A Forge admin approves a pilot or records a payment. (A billing webhook runs with the service role
-- and updates challenges.sponsorship directly.)
create function public.set_sponsorship(p_id text, p_status text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forge_admin() then
    raise exception 'Forge admins only.' using errcode = '42501';
  end if;
  if p_status not in ('paid', 'pilot', 'unpaid') then raise exception 'Unknown sponsorship status.' using errcode = 'P0001'; end if;
  update public.challenges set sponsorship = p_status where id = p_id;
  if not found then raise exception 'No such challenge.' using errcode = 'P0001'; end if;
  update public.billing_requests set status = case when p_status = 'unpaid' then 'cancelled' else 'paid' end
    where challenge_id = p_id and status in ('requested', 'checkout');
  return p_status;
end $$;

-- Close entries (judging), then pick up to three winners and announce them (closed).
create function public.close_challenge(p_id text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_id for update;
  if c.id is null or not public.is_org_admin(c.org_id) then raise exception 'Only the sponsor''s admins can do that.' using errcode = '42501'; end if;
  if c.status = 'open' then update public.challenges set status = 'judging' where id = p_id; return 'judging'; end if;
  if c.status = 'judging' then
    if not exists (select 1 from public.challenge_entries where challenge_id = p_id and placement is not null) then
      raise exception 'Pick at least one winner first.' using errcode = 'P0001';
    end if;
    update public.challenges set status = 'closed' where id = p_id; return 'closed';
  end if;
  raise exception 'This challenge isn''t live.' using errcode = 'P0001';
end $$;

create function public.place_entry(p_entry bigint, p_place int) returns void
language plpgsql security definer set search_path = public as $$
declare e public.challenge_entries; c public.challenges;
begin
  select * into e from public.challenge_entries where id = p_entry;
  select * into c from public.challenges where id = e.challenge_id;
  if c.id is null or not public.is_org_admin(c.org_id) then raise exception 'Only the sponsor''s admins can pick winners.' using errcode = '42501'; end if;
  if c.status <> 'judging' then raise exception 'Close entries before picking winners.' using errcode = 'P0001'; end if;
  if p_place is not null and (p_place < 1 or p_place > 3) then raise exception 'Places are 1st, 2nd or 3rd.' using errcode = 'P0001'; end if;
  if p_place is not null and exists (select 1 from public.challenge_entries where challenge_id = c.id and placement = p_place and id <> p_entry) then
    raise exception 'Another entry already has that place.' using errcode = 'P0001';
  end if;
  update public.challenge_entries set placement = p_place where id = p_entry;
end $$;

-- Entry counts are public even though entries aren't.
create function public.challenge_entry_counts(p_ids text[]) returns table (challenge_id text, entries bigint)
language sql stable security definer set search_path = public as $$
  select e.challenge_id, count(*) from public.challenge_entries e
  join public.challenges c on c.id = e.challenge_id and (c.status <> 'draft' or public.is_org_admin(c.org_id))
  where e.challenge_id = any (p_ids) group by e.challenge_id
$$;

revoke execute on function public.publish_challenge(text), public.request_sponsorship(text, text, text), public.set_sponsorship(text, text),
  public.close_challenge(text), public.place_entry(bigint, int), public.challenge_entry_counts(text[]) from anon, public;
grant execute on function public.publish_challenge(text), public.request_sponsorship(text, text, text), public.set_sponsorship(text, text),
  public.close_challenge(text), public.place_entry(bigint, int), public.challenge_entry_counts(text[]) to authenticated;

create function public.challenges_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.challenges_ready() to authenticated;
