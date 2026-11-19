-- Step 74: club officers from their AI tools (docs/mcp-workflows.md). Run after verify-links.sql.
-- Additive and safe to re-run.
--
-- Two more action kinds shared with Ember's cards (tool-actions.sql), both drafts only (no
-- tool_do_ function, so a tool never publishes for a club), and Ember's weekly brief as a read:
-- - event: a club event, for whoever can host the club's events in the app (its admins and owner,
--   club-events.sql). The officer edits and publishes it from the card.
-- - club_post: an announcement in a club, for its moderators and up.
-- - mcp_club_brief(): "this week" in a club for its moderators and up, the same numbers as Ember's
--   club_report and the Manage → Report tab (web/src/lib/club-report.ts), plus what waits for review.
-- Verifying stays in the app: nothing here reads or changes a milestone's review.

-- ---------- event (draft only) ----------
create or replace function public.tool_check_event(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid text := coalesce(public.tool_text(p, 'club_id'), ''); c public.communities;
  ttl text := coalesce(public.tool_text(p, 'title'), ''); descr text := coalesce(public.tool_text(p, 'description'), '');
  typ text := coalesce(nullif(public.tool_text(p, 'type'), ''), 'Workshop'); fmt text := coalesce(nullif(public.tool_text(p, 'format'), ''), 'In person');
  loc text := coalesce(public.tool_text(p, 'location'), ''); st timestamptz; en timestamptz;
begin
  select * into c from public.communities where id = cid;
  if c.id is null or not public.can_host_community_events(cid) then
    raise exception 'Only a club''s admins and owner can host its events. my_clubs shows your role in each.' using errcode = 'P0001';
  end if;
  if char_length(ttl) not between 1 and 120 then raise exception 'Give the event a title (up to 120 characters).' using errcode = 'P0001'; end if;
  if char_length(descr) > 2000 then raise exception 'Keep the description under 2,000 characters.' using errcode = 'P0001'; end if;
  if char_length(loc) > 160 then raise exception 'Keep the location under 160 characters.' using errcode = 'P0001'; end if;
  if typ not in ('Career fair', 'Networking', 'Workshop', 'Talk', 'Hackathon', 'Conference') then
    raise exception 'type is Career fair, Networking, Workshop, Talk, Hackathon or Conference.' using errcode = 'P0001';
  end if;
  if fmt not in ('Online', 'In person', 'Hybrid') then raise exception 'format is Online, In person or Hybrid.' using errcode = 'P0001'; end if;
  begin
    st := (p->>'starts_at')::timestamptz; en := nullif(p->>'ends_at', '')::timestamptz;
  exception when others then
    raise exception 'Give times as ISO 8601 with a timezone offset, e.g. 2026-12-03T18:00:00-05:00.' using errcode = 'P0001';
  end;
  if st is null or st <= now() then raise exception 'Give a start time in the future.' using errcode = 'P0001'; end if;
  if en is null or en <= st then en := st + interval '2 hours'; end if;
  return jsonb_build_object('club_id', cid, 'club_name', c.name, 'title', ttl, 'description', descr, 'type', typ, 'format', fmt,
    'location', loc, 'topic', coalesce(nullif(public.tool_text(p, 'topic'), ''), c.topics[1], ''), 'starts_at', st, 'ends_at', en);
end $$;

-- ---------- club_post: an announcement (draft only) ----------
create or replace function public.tool_check_club_post(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid text := coalesce(public.tool_text(p, 'club_id'), ''); c public.communities; body text := coalesce(public.tool_text(p, 'body'), '');
begin
  select * into c from public.communities where id = cid;
  if c.id is null or public.my_rank(cid) < 3 then
    raise exception 'Only a club''s moderators, admins and owner draft its announcements. my_clubs shows your role in each.' using errcode = 'P0001';
  end if;
  if char_length(body) not between 1 and 3000 then raise exception 'Write between 1 and 3,000 characters.' using errcode = 'P0001'; end if;
  return jsonb_build_object('club_id', cid, 'club_name', c.name, 'body', body, 'kind', 'update');
end $$;

revoke execute on function public.tool_check_event(jsonb), public.tool_check_club_post(jsonb) from anon, authenticated, public;

-- ---------- club_brief: Ember's weekly report, for the club's officers ----------
create or replace function public.mcp_club_brief(p_hash text, p_club text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.mcp_user(p_hash); c public.communities; wk timestamptz := now() - interval '7 days'; r jsonb;
begin
  if me is null then raise exception 'invalid token' using errcode = '28000'; end if;
  select * into c from public.communities where id = p_club;
  if c.id is null or coalesce((select public.role_rank(role) from public.community_members where community_id = p_club and uid = me), 0) < 3 then
    raise exception 'Only a club''s moderators, admins and owner can read its brief. my_clubs shows your role in each.' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'club', c.name, 'club_id', c.id, 'members', c.member_count,
    'new_members', coalesce((select jsonb_agg(btrim(first_name || ' ' || last_name)) from (select first_name, last_name from public.community_members
                     where community_id = c.id and joined_at > wk order by joined_at desc limit 12) n), '[]'),
    'posts', jsonb_build_object(
      'this_week', (select count(*) from public.posts where community_id = c.id and status = 'visible' and created_at > wk),
      'last_week', (select count(*) from public.posts where community_id = c.id and status = 'visible' and created_at between wk - interval '7 days' and wk)),
    'top_post', (select jsonb_build_object('url', '/post/' || id, 'body', left(regexp_replace(body, '\s+', ' ', 'g'), 160), 'author', btrim(author_first || ' ' || author_last),
                   'likes', like_count, 'comments', comment_count)
                 from public.posts where community_id = c.id and status = 'visible' and created_at > wk
                 order by like_count + comment_count * 2 desc, created_at desc limit 1),
    'most_active', coalesce((select jsonb_agg(jsonb_build_object('name', n, 'posts', k)) from (
                     select btrim(author_first || ' ' || author_last) n, count(*) k from public.posts
                      where community_id = c.id and status = 'visible' and created_at > wk group by 1 order by 2 desc limit 3) a), '[]'),
    'upcoming_events', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'starts_at', starts_at, 'going', rsvp_count, 'url', '/events/' || id) order by starts_at)
                     from public.events where community_id = c.id and status = 'published' and starts_at between now() and now() + interval '14 days'), '[]'),
    'past_events', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'starts_at', starts_at, 'went', rsvp_count) order by starts_at desc)
                     from public.events where community_id = c.id and status = 'published' and starts_at between wk and now()), '[]'),
    'milestones', jsonb_build_object(
      'verified_this_week', (select count(*) from public.milestones where community_id = c.id and status = 'verified' and reviewed_at > wk),
      'waiting_for_review', (select count(*) from public.milestones where community_id = c.id and status = 'pending'),
      'review_in_brazework', '/c/' || c.id || '/manage?tab=verify'),
    'join_requests', (select count(*) from public.community_requests where community_id = c.id),
    'report_url', '/c/' || c.id || '/manage?tab=report',
    'your_role', (select role from public.community_members where community_id = c.id and uid = me),
    'can_host_events', coalesce((select public.role_rank(role) from public.community_members where community_id = c.id and uid = me), 0) >= 4
  ) into r;
  return r;
end $$;
grant execute on function public.mcp_club_brief(text, text) to anon, authenticated;

create or replace function public.tool_officers_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.tool_officers_ready() to authenticated;
