-- Step 35: claiming a club (Linear FIX-47). When a chapter's real officers arrive and someone else
-- already made the club, an officer asks to take it over: their role in the real organization and
-- proof (a page listing the officers, a school directory, an email from the advisor). A Forge
-- admin decides on /admin. If approved, the claimant becomes the owner and the previous owner stays
-- in the club as a member (the new owner can promote them); the club's members, posts, events and
-- verified work don't change. Both are notified, and the change is logged in club_handoffs.
-- Additive and safe to re-run.

create table if not exists public.club_claims (
  id bigint generated always as identity primary key,
  community_id text not null references public.communities (id) on delete cascade,
  claimant uuid not null references public.profiles (id) on delete cascade,
  role_title text not null check (char_length(role_title) between 2 and 80),
  evidence text not null check (char_length(evidence) between 10 and 600),
  status text not null default 'open' check (status in ('open', 'approved', 'denied', 'withdrawn')),
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text not null default '' check (char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists club_claims_community_id_fk_idx on public.club_claims (community_id);
create index if not exists club_claims_claimant_fk_idx on public.club_claims (claimant);
create index if not exists club_claims_decided_by_fk_idx on public.club_claims (decided_by);
-- One open claim per person per club.
create unique index if not exists club_claims_one_open on public.club_claims (community_id, claimant) where status = 'open';

alter table public.club_claims enable row level security;
revoke all on public.club_claims from anon, authenticated;
grant select on public.club_claims to authenticated;
drop policy if exists "your claims, or all for Forge admins" on public.club_claims;
create policy "your claims, or all for Forge admins" on public.club_claims for select to authenticated
  using (claimant = auth.uid() or public.is_forge_admin());

-- Ask to take over a club. Needs a school email (the same rule as verified clubs), not already the
-- owner, at most one open claim per club and three open claims in all.
create or replace function public.request_club_claim(p_cid text, p_role text, p_evidence text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); new_id bigint;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = p_cid) then raise exception 'That club isn''t on Forge.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.community_members where community_id = p_cid and uid = me and role = 'owner') then
    raise exception 'You already own this club.' using errcode = 'P0001';
  end if;
  if not public.is_school_email((select email from auth.users where id = me)) then
    raise exception 'Claiming a club needs a school email on your account.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.club_claims where claimant = me and status = 'open') >= 3 then
    raise exception 'You have three open claims already. Wait for a decision first.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.club_claims where community_id = p_cid and claimant = me and status = 'open') then
    raise exception 'You already asked to claim this club. A Forge admin will decide soon.' using errcode = 'P0001';
  end if;
  insert into public.club_claims (community_id, claimant, role_title, evidence)
    values (p_cid, me, btrim(coalesce(p_role, '')), btrim(coalesce(p_evidence, '')))
    returning id into new_id;
  return new_id;
end $$;

-- Withdraw your own open claim.
create or replace function public.withdraw_club_claim(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.club_claims set status = 'withdrawn', decided_at = now()
   where id = p_id and claimant = auth.uid() and status = 'open';
  if not found then raise exception 'That claim isn''t open.' using errcode = 'P0001'; end if;
end $$;

-- A Forge admin approves or denies. Approving hands the club over: the claimant becomes the owner
-- (joining if they weren't a member), the previous owner becomes a member, and other open claims on
-- the same club are closed.
create or replace function public.decide_club_claim(p_id bigint, p_approve boolean, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare c public.club_claims; old_owner uuid; club_name text;
begin
  if not public.is_forge_admin() then raise exception 'Forge admins only.' using errcode = '42501'; end if;
  select * into c from public.club_claims where id = p_id for update;
  if c.id is null or c.status <> 'open' then raise exception 'That claim isn''t open.' using errcode = 'P0001'; end if;
  update public.club_claims set status = case when p_approve then 'approved' else 'denied' end,
    decided_by = auth.uid(), decided_at = now(), decision_note = left(btrim(coalesce(p_note, '')), 300)
   where id = p_id;
  select name, owner_id into club_name, old_owner from public.communities where id = c.community_id for update;
  if not p_approve then
    perform public.notify(c.claimant, auth.uid(), 'community_approved', null, null, c.community_id,
      'Your claim to ' || club_name || ' wasn''t approved' || case when btrim(coalesce(p_note, '')) <> '' then ': ' || left(btrim(p_note), 200) else '.' end);
    return;
  end if;
  -- The previous owner(s) stay in the club as members.
  update public.community_members set role = 'member' where community_id = c.community_id and role = 'owner' and uid <> c.claimant;
  insert into public.community_members (community_id, uid, role) values (c.community_id, c.claimant, 'owner')
    on conflict (community_id, uid) do update set role = 'owner';
  update public.communities set owner_id = c.claimant,
    owner_name = coalesce((select btrim(first_name || ' ' || last_name) from public.profiles where id = c.claimant), owner_name)
   where id = c.community_id;
  update public.club_claims set status = 'denied', decided_by = auth.uid(), decided_at = now(), decision_note = 'Another claim was approved.'
   where community_id = c.community_id and status = 'open' and id <> p_id;
  insert into public.club_handoffs (community_id, role, from_uid, to_uid, note)
    values (c.community_id, 'owner', old_owner, c.claimant, left('Claim approved: ' || c.role_title, 300));
  perform public.notify(c.claimant, auth.uid(), 'community_approved', null, null, c.community_id, 'You''re now the owner of ' || club_name);
  if old_owner is not null and old_owner <> c.claimant then
    perform public.notify(old_owner, auth.uid(), 'community_approved', null, null, c.community_id,
      club_name || ' was handed to its officers after a verified claim. You''re still a member.');
  end if;
end $$;

revoke execute on function public.request_club_claim(text, text, text) from anon, public;
revoke execute on function public.withdraw_club_claim(bigint) from anon, public;
revoke execute on function public.decide_club_claim(bigint, boolean, text) from anon, public;
grant execute on function public.request_club_claim(text, text, text) to authenticated;
grant execute on function public.withdraw_club_claim(bigint) to authenticated;
grant execute on function public.decide_club_claim(bigint, boolean, text) to authenticated;
