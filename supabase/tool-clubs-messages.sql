-- Step 70: clubs and messages from your AI tools (docs/mcp-workflows.md). Run after tool-rsvp.sql.
-- Additive and safe to re-run.
--
-- Three more action kinds shared with Ember's cards (tool-actions.sql), and a read:
-- - join: join a public club, or ask to join one that approves members (schema.sql's rules: not
--   already in it, not banned).
-- - invite: accept an invite link someone sent the member (invites.sql's accept_invite()).
-- - message: a reply or a first message, always a draft: the member reads it and sends it from
--   Brazework (there's no tool_do_message, so a tool can never send one).
-- - mcp_inbox(): the member's conversations and message requests, newest first, or one
--   conversation's last 20 messages, so an assistant can draft a reply that fits.

-- ---------- join ----------
create or replace function public.tool_check_join(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid text := coalesce(public.tool_text(p, 'club_id'), ''); c public.communities;
begin
  select * into c from public.communities where id = cid;
  if c.id is null then raise exception 'No club with that id. search lists clubs with their ids.' using errcode = 'P0001'; end if;
  if public.my_rank(cid) > 0 then raise exception 'You''re already in %.', c.name using errcode = 'P0001'; end if;
  if public.am_banned(cid) then raise exception 'You can''t join %.', c.name using errcode = 'P0001'; end if;
  if c.privacy <> 'public' and exists (select 1 from public.community_requests where community_id = cid and uid = auth.uid()) then
    raise exception 'You''ve already asked to join %. Its moderators will answer.', c.name using errcode = 'P0001';
  end if;
  return jsonb_build_object('club_id', cid, 'club_name', c.name, 'privacy', case when c.privacy = 'public' then 'public' else 'approval' end);
end $$;

create or replace function public.tool_do_join(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p->>'privacy' = 'public' then
    insert into public.community_members (community_id, uid, role) values (p->>'club_id', auth.uid(), 'member');
  else
    insert into public.community_requests (community_id, uid) values (p->>'club_id', auth.uid());
  end if;
  return jsonb_build_object('id', p->>'club_id', 'title', p->>'club_name', 'url', '/c/' || (p->>'club_id'),
    'status', case when p->>'privacy' = 'public' then 'joined' else 'requested' end, 'via', p_via);
end $$;

-- ---------- invite ----------
create or replace function public.tool_check_invite(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  raw text := coalesce(public.tool_text(p, 'code'), '');
  want text := coalesce(substring(raw from '([0-9a-f]{16})/?$'), '');
  inv public.community_invites; c public.communities;
begin
  select * into inv from public.community_invites where code = want;
  if inv.code is null or not public.invite_usable(inv) then
    raise exception 'That invite link has expired or was turned off. Ask for a new one.' using errcode = 'P0001';
  end if;
  select * into c from public.communities where id = inv.community_id;
  if public.my_rank(c.id) > 0 then raise exception 'You''re already in %.', c.name using errcode = 'P0001'; end if;
  if public.am_banned(c.id) then raise exception 'You can''t join %.', c.name using errcode = 'P0001'; end if;
  return jsonb_build_object('code', inv.code, 'club_id', c.id, 'club_name', c.name);
end $$;

create or replace function public.tool_do_invite(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid text := public.accept_invite(p->>'code');
begin
  return jsonb_build_object('id', cid, 'title', p->>'club_name', 'url', '/c/' || cid, 'status', 'joined', 'via', p_via);
end $$;

-- ---------- message (draft only) ----------
-- To a person (person_id) or in a conversation the member is in (conversation_id).
create or replace function public.tool_check_message(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  conv text := public.tool_text(p, 'conversation_id'); who uuid := public.tool_uuid(public.tool_text(p, 'person_id'));
  body text := coalesce(public.tool_text(p, 'body'), ''); c public.conversations;
begin
  if conv is not null and conv <> '' then
    select * into c from public.conversations where id = conv and auth.uid() in (user_a, user_b);
    if c.id is null then raise exception 'That isn''t one of your conversations. my_inbox lists them with their ids.' using errcode = 'P0001'; end if;
    who := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  end if;
  if who is null or not exists (select 1 from public.profiles where id = who) then
    raise exception 'Say who it''s to: a conversation_id from my_inbox, or a person''s id from search.' using errcode = 'P0001';
  end if;
  if who = auth.uid() then raise exception 'That''s you.' using errcode = 'P0001'; end if;
  if public.blocked_between(auth.uid(), who) then raise exception 'You can''t message them.' using errcode = 'P0001'; end if;
  if char_length(body) not between 1 and 2000 then raise exception 'Write between 1 and 2,000 characters.' using errcode = 'P0001'; end if;
  -- The app's message rules (messages.sql): blocks, "who can message you", one message per request.
  perform public.message_block_check(auth.uid(), who);
  select * into c from public.conversations where user_a = least(auth.uid(), who) and user_b = greatest(auth.uid(), who);
  if c.id is null then
    if not exists (select 1 from public.connections where status = 'accepted' and least(from_id, to_id) = least(auth.uid(), who) and greatest(from_id, to_id) = greatest(auth.uid(), who))
       and not public.can_request_message(auth.uid(), who) then
      raise exception 'This member isn''t accepting messages from you right now.' using errcode = 'P0001';
    end if;
  elsif c.status = 'request' and c.started_by = auth.uid() and exists (select 1 from public.messages where conversation_id = c.id) then
    raise exception 'You can send one message until they accept your request.' using errcode = 'P0001';
  end if;
  -- Replying to someone's request accepts it (the card says so before the member sends).
  return jsonb_build_object('body', body, 'conversation_id', c.id, 'accepts_request', coalesce(c.status = 'request' and c.started_by <> auth.uid(), false)) || public.tool_person(who);
end $$;

revoke execute on function public.tool_check_join(jsonb), public.tool_do_join(jsonb, text), public.tool_check_invite(jsonb),
  public.tool_do_invite(jsonb, text), public.tool_check_message(jsonb) from anon, authenticated, public;

-- ---------- my_inbox ----------
create or replace function public.mcp_inbox(p_hash text, p_conversation text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash); cv public.conversations;
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  if p_conversation is not null and p_conversation <> '' then
    select * into cv from public.conversations where id = p_conversation and me in (user_a, user_b);
    if cv.id is null then raise exception 'That isn''t one of your conversations. Call my_inbox without an id to list them.' using errcode = 'P0001'; end if;
    return jsonb_build_object('conversation_id', cv.id, 'url', '/messages/' || cv.id,
      'with', public.tool_person(case when cv.user_a = me then cv.user_b else cv.user_a end),
      'request', cv.status = 'request' and cv.started_by <> me,
      'messages', coalesce((select jsonb_agg(jsonb_build_object('from', case when m.sender_id = me then 'me' else 'them' end, 'body', m.body, 'at', m.created_at) order by m.created_at)
                            from (select * from public.messages where conversation_id = cv.id order by created_at desc limit 20) m), '[]'));
  end if;
  return coalesce((select jsonb_agg(x order by x->>'last_at' desc nulls last) from (
    select jsonb_build_object('conversation_id', c.id, 'url', '/messages/' || c.id,
             'with', public.tool_person(case when c.user_a = me then c.user_b else c.user_a end),
             'kind', case when c.status = 'request' and c.started_by <> me then 'request to you'
                          when c.status = 'request' then 'waiting for them to accept' else 'conversation' end,
             'last', left(c.last_body, 200), 'last_from', case when c.last_sender = me then 'me' else 'them' end, 'last_at', c.last_message_at,
             'unread', c.last_sender is distinct from me and c.last_message_at > coalesce((select read_at from public.conversation_reads r where r.conversation_id = c.id and r.user_id = me), '-infinity')) x
      from public.conversations c
     where me in (c.user_a, c.user_b) and c.last_message_at is not null
       and not public.blocked_between(c.user_a, c.user_b)
     order by c.last_message_at desc limit 20) s), '[]');
end $$;
grant execute on function public.mcp_inbox(text, text) to anon, authenticated;

create or replace function public.tool_clubs_messages_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.tool_clubs_messages_ready() to authenticated;
