-- Officer handoff: clubs change officers every year, so an outgoing officer passes their role to a
-- successor in one step. The club, its members, history, verified work and Discord link stay; only
-- who holds the role changes, and the outgoing officer becomes a member (verifying power ends at
-- once, since every check reads the current role). Run after verification.sql. Additive.

create table public.club_handoffs (
  id bigint generated always as identity primary key,
  community_id text not null references public.communities (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'moderator')),
  from_uid uuid references public.profiles (id) on delete set null,
  to_uid uuid references public.profiles (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index club_handoffs_club_idx on public.club_handoffs (community_id, created_at desc);
alter table public.club_handoffs enable row level security;
create policy "members see their club's handoffs" on public.club_handoffs for select to authenticated
  using (public.my_rank(community_id) > 0);
revoke all on public.club_handoffs from anon, authenticated;
grant select on public.club_handoffs to authenticated;

-- Pass your officer role to a member of the club. Owner → new owner; admin or moderator → the same
-- role. You stay in the club as a member.
create function public.hand_off_role(p_cid text, p_to uuid, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare mine text; theirs text;
begin
  select role into mine from public.community_members where community_id = p_cid and uid = auth.uid() for update;
  if mine is null or public.role_rank(mine) < 3 then raise exception 'Only officers can hand off a role.' using errcode = '42501'; end if;
  if p_to = auth.uid() then raise exception 'Pick someone else to take over.' using errcode = 'P0001'; end if;
  select role into theirs from public.community_members where community_id = p_cid and uid = p_to for update;
  if theirs is null then raise exception 'They need to be in the club first. Invite them, then hand off.' using errcode = 'P0001'; end if;
  if public.is_banned(p_cid, p_to) then raise exception 'They can''t take over this club.' using errcode = 'P0001'; end if;
  if public.role_rank(theirs) >= public.role_rank(mine) then raise exception 'They already hold this role or a higher one.' using errcode = 'P0001'; end if;
  update public.community_members set role = mine where community_id = p_cid and uid = p_to;
  update public.community_members set role = 'member' where community_id = p_cid and uid = auth.uid();
  if mine = 'owner' then
    update public.communities set owner_id = p_to,
      owner_name = coalesce((select btrim(first_name || ' ' || last_name) from public.profiles where id = p_to), owner_name)
     where id = p_cid;
  end if;
  insert into public.club_handoffs (community_id, role, from_uid, to_uid, note) values (p_cid, mine, auth.uid(), p_to, left(btrim(coalesce(p_note, '')), 300));
  perform public.notify(p_to, auth.uid(), 'community_approved', null, null, p_cid, 'You''re now ' || mine);
end $$;

revoke execute on function public.hand_off_role(text, uuid, text) from anon, public;
grant execute on function public.hand_off_role(text, uuid, text) to authenticated;
