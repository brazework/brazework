-- Membership controls for group chats. Club and event chats follow their parent unless a member opts out.
begin;

create table if not exists public.chat_opt_outs (
  chat_id text not null references public.chats (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  primary key (chat_id, uid)
);
alter table public.chat_opt_outs enable row level security;
revoke all on public.chat_opt_outs from public, anon, authenticated;

create or replace function public.can_read_chat(p_chat text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chats c
    where c.id = p_chat
      and not exists (
        select 1 from public.chat_opt_outs o where o.chat_id = c.id and o.uid = auth.uid()
      )
      and (
        (c.kind = 'club' and public.my_rank(c.community_id) >= 1)
        or (c.kind = 'team' and public.my_rank(c.community_id) >= 1
            and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.uid = auth.uid()))
        or (c.kind = 'event' and (
            exists (select 1 from public.event_rsvps r where r.event_id = c.event_id and r.user_id = auth.uid())
            or exists (
              select 1 from public.events e where e.id = c.event_id and (
                (e.community_id is not null and public.my_rank(e.community_id) >= 3)
                or exists (select 1 from public.organization_admins a where a.org_id = e.org_id and a.uid = auth.uid())
              )
            )
        ))
      )
  )
$$;

create or replace function public.open_club_chat(p_community text) returns text
language plpgsql security definer set search_path = '' as $$
declare cid text;
begin
  if public.my_rank(p_community) < 1 then
    raise exception 'Join the club to see its chat.' using errcode = 'P0001';
  end if;
  insert into public.chats (kind, community_id) values ('club', p_community)
  on conflict (community_id) where kind = 'club' do nothing;
  select id into cid from public.chats where kind = 'club' and community_id = p_community;
  delete from public.chat_opt_outs where chat_id = cid and uid = auth.uid();
  return cid;
end $$;

create or replace function public.open_event_chat(p_event text) returns text
language plpgsql security definer set search_path = '' as $$
declare cid text; e public.events;
begin
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'That event wasn''t found.' using errcode = 'P0001'; end if;
  if not (
    exists (select 1 from public.event_rsvps r where r.event_id = p_event and r.user_id = auth.uid())
    or (e.community_id is not null and public.my_rank(e.community_id) >= 3)
    or exists (select 1 from public.organization_admins a where a.org_id = e.org_id and a.uid = auth.uid())
  ) then
    raise exception 'RSVP to join the event chat.' using errcode = 'P0001';
  end if;
  insert into public.chats (kind, event_id, community_id) values ('event', p_event, e.community_id)
  on conflict (event_id) where kind = 'event' do nothing;
  select id into cid from public.chats where kind = 'event' and event_id = p_event;
  delete from public.chat_opt_outs where chat_id = cid and uid = auth.uid();
  return cid;
end $$;

create or replace function public.leave_chat(p_chat text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  chat public.chats;
  successor uuid;
begin
  if me is null then
    raise exception 'Log in again.' using errcode = '42501';
  end if;

  -- Serialize departures and deletion so two members cannot hand ownership to each other.
  select * into chat from public.chats where id = p_chat for update;
  if not found or not public.can_read_chat(p_chat) then return; end if;

  if chat.kind = 'team' then
    if chat.created_by = me or chat.created_by is null then
      select m.uid into successor
        from public.chat_members m
        join public.community_members cm on cm.community_id = chat.community_id and cm.uid = m.uid
       where m.chat_id = p_chat and m.uid <> me
       order by m.joined_at, m.uid
       limit 1;
      if successor is not null then
        update public.chats set created_by = successor where id = p_chat;
      end if;
    end if;

    delete from public.chat_members where chat_id = p_chat and uid = me;
  else
    insert into public.chat_opt_outs (chat_id, uid) values (p_chat, me)
    on conflict do nothing;
  end if;
end $$;

create or replace function public.delete_owned_team_chat(p_chat text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.chats
   where id = p_chat and kind = 'team' and created_by = auth.uid()
     and public.can_read_chat(p_chat);
  if not found then
    raise exception 'Only the team chat owner can delete this chat.' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.delete_owned_team_chat(text) from public, anon;
grant execute on function public.delete_owned_team_chat(text) to authenticated;

create or replace function public.group_chat_controls_ready() returns boolean
language sql stable set search_path = '' as $$ select true $$;
grant execute on function public.group_chat_controls_ready() to authenticated;

commit;
