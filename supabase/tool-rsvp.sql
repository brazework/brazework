-- Step 68: RSVP from your AI tools (docs/mcp-workflows.md). Run after tool-actions.sql. Additive and
-- safe to re-run.
--
-- One more action kind shared with Ember's cards (tool-actions.sql): rsvp. going: true saves the
-- member a spot, going: false takes it back (only their own). The rules are the app's
-- (events.sql, club-events.sql): an event they can see, published and not over.

create or replace function public.tool_check_rsvp(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  eid text := coalesce(public.tool_text(p, 'event_id'), ''); e public.events;
  going boolean := lower(coalesce(p->>'going', 'true')) <> 'false'; mine boolean;
begin
  select * into e from public.events where id = eid;
  if e.id is null or e.status <> 'published'
     or not ((e.org_id is not null and exists (select 1 from public.organizations o where o.id = e.org_id and o.verification_status = 'verified'))
             or (e.community_id is not null and public.can_view(e.community_id))) then
    raise exception 'No upcoming event with that id. upcoming_events lists them with their ids.' using errcode = 'P0001';
  end if;
  mine := exists (select 1 from public.event_rsvps where event_id = eid and user_id = auth.uid());
  if going and e.ends_at <= now() then raise exception 'That event is over, so RSVPs are closed.' using errcode = 'P0001'; end if;
  if going and mine then raise exception 'You''re already going to %.', e.title using errcode = 'P0001'; end if;
  if not going and not mine then raise exception 'You weren''t going to %, so there''s nothing to cancel.', e.title using errcode = 'P0001'; end if;
  return jsonb_build_object('event_id', eid, 'title', e.title, 'starts_at', e.starts_at, 'going', e.rsvp_count, 'cancel', not going,
    'where', case when e.format = 'Online' then 'Online' else coalesce(e.location, '') end,
    'host', coalesce((select name from public.communities where id = e.community_id), (select name from public.organizations where id = e.org_id), ''));
end $$;

create or replace function public.tool_do_rsvp(p jsonb, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if (p->>'cancel')::boolean then
    delete from public.event_rsvps where event_id = p->>'event_id' and user_id = auth.uid();
  else
    insert into public.event_rsvps (event_id, user_id) values (p->>'event_id', auth.uid()) on conflict do nothing;
  end if;
  return jsonb_build_object('id', p->>'event_id', 'title', p->>'title', 'starts_at', p->>'starts_at', 'where', p->>'where', 'host', p->>'host',
    'url', '/events/' || (p->>'event_id'), 'status', case when (p->>'cancel')::boolean then 'not going' else 'going' end, 'via', p_via);
end $$;

revoke execute on function public.tool_check_rsvp(jsonb), public.tool_do_rsvp(jsonb, text) from anon, authenticated, public;

create or replace function public.tool_rsvp_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.tool_rsvp_ready() to authenticated;
