-- Club invite links: /join/<code>. Run after media.sql. Additive: nothing existing changes.
--
-- Helpers and above (the same people who approve join requests) create links. A link can expire,
-- can have a use limit, and can be revoked. Joining through a link skips approval, so it's how an
-- approval-only club brings people in directly; bans still apply.

create table public.community_invites (
  code text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  community_id text not null references public.communities (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses between 1 and 10000),
  uses integer not null default 0,
  revoked boolean not null default false
);
create index community_invites_community_idx on public.community_invites (community_id, created_at desc);

revoke all on public.community_invites from anon, authenticated;
alter table public.community_invites enable row level security;

-- Managers (rank 2+) see, create and revoke their club's links. Nobody else can list them;
-- people with a code use invite_preview() and accept_invite() instead.
grant select on public.community_invites to authenticated;
grant insert (community_id, expires_at, max_uses) on public.community_invites to authenticated;
grant update (revoked) on public.community_invites to authenticated;
create policy "managers read invites" on public.community_invites for select to authenticated
  using (public.my_rank(community_id) >= 2);
create policy "managers create invites" on public.community_invites for insert to authenticated
  with check (public.my_rank(community_id) >= 2 and (expires_at is null or expires_at > now()));
create policy "managers revoke invites" on public.community_invites for update to authenticated
  using (public.my_rank(community_id) >= 2) with check (public.my_rank(community_id) >= 2);

-- Is this code usable right now?
create function public.invite_usable(i public.community_invites) returns boolean
language sql stable as $$
  select not i.revoked and (i.expires_at is null or i.expires_at > now()) and (i.max_uses is null or i.uses < i.max_uses)
$$;

-- What an invite page shows: the club, before you join. Works signed out, so a link can be
-- opened by someone who doesn't have an account yet. Returns nothing for a bad or used-up code.
create function public.invite_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('community_id', c.id, 'name', c.name, 'about', c.about, 'field', c.field,
                            'privacy', c.privacy, 'member_count', c.member_count)
  from public.community_invites i join public.communities c on c.id = i.community_id
  where i.code = p_code and public.invite_usable(i)
$$;

-- Joins the club the code is for and returns its id. Already a member: just returns the id.
create function public.accept_invite(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); inv public.community_invites;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into inv from public.community_invites where code = p_code for update;
  if not found or not public.invite_usable(inv) then
    raise exception 'This invite link has expired or was turned off. Ask for a new one.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.community_members where community_id = inv.community_id and uid = me) then
    return inv.community_id;
  end if;
  if public.is_banned(inv.community_id, me) then
    raise exception 'You can''t join this community.' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, uid, role) values (inv.community_id, me, 'member') on conflict do nothing;
  delete from public.community_requests where community_id = inv.community_id and uid = me;
  update public.community_invites set uses = uses + 1 where code = p_code;
  return inv.community_id;
end $$;

-- Supabase grants new functions to anon by default: only the preview is meant for signed-out visitors.
revoke execute on function public.invite_usable(public.community_invites), public.invite_preview(text), public.accept_invite(text) from public, anon;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.accept_invite(text), public.invite_usable(public.community_invites) to authenticated;
