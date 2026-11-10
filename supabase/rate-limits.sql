-- Limits on how fast one member can post, reply, message, send message requests and submit
-- milestones, so spam and automated abuse stop at the database whatever client is used. Limits
-- live in app_config (change them without a deploy). They apply to signed-in members only; seeds and
-- admin scripts run without a member and aren't limited. Run after challenges.sql. Additive.

insert into public.app_config (key, value) values
  ('limit_posts_per_hour', '20'),
  ('limit_comments_per_hour', '60'),
  ('limit_messages_per_hour', '200'),
  ('limit_requests_per_day', '20'),
  ('limit_org_requests_per_week', '50'),
  ('limit_milestones_per_day', '20')
on conflict (key) do nothing;

create function public.slow_down(what text) returns void language plpgsql as $$
begin
  raise exception 'You''re % faster than Forge allows. Wait a little and try again.', what using errcode = 'P0001';
end $$;

create function public.posts_pace() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is not null and (select count(*) from public.posts where author_id = me and created_at > now() - interval '1 hour')
       >= public.config_int('limit_posts_per_hour', 20) then
    perform public.slow_down('posting');
  end if;
  return new;
end $$;
create trigger posts_pace before insert on public.posts for each row execute function public.posts_pace();

create function public.comments_pace() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is not null and (select count(*) from public.comments where author_id = me and created_at > now() - interval '1 hour')
       >= public.config_int('limit_comments_per_hour', 60) then
    perform public.slow_down('replying');
  end if;
  return new;
end $$;
create trigger comments_pace before insert on public.comments for each row execute function public.comments_pace();

create function public.messages_pace() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is not null and (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 hour')
       >= public.config_int('limit_messages_per_hour', 200) then
    perform public.slow_down('messaging');
  end if;
  return new;
end $$;
create trigger messages_pace before insert on public.messages for each row execute function public.messages_pace();

-- Message requests (to people you aren't connected with): a daily cap for everyone, and a weekly cap
-- for company and school admins, so outreach stays personal.
create function public.requests_pace() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or new.status <> 'request' or new.started_by <> me then return new; end if;
  if (select count(*) from public.conversations where started_by = me and status = 'request' and created_at > now() - interval '1 day')
       >= public.config_int('limit_requests_per_day', 20) then
    perform public.slow_down('sending message requests');
  end if;
  if exists (select 1 from public.organization_admins oa join public.organizations o on o.id = oa.org_id
             where oa.uid = me and o.type in ('company', 'school'))
     and (select count(*) from public.conversations where started_by = me and created_at > now() - interval '7 days'
          and not exists (select 1 from public.connections c where c.status = 'accepted'
                          and least(c.from_id, c.to_id) = conversations.user_a and greatest(c.from_id, c.to_id) = conversations.user_b))
       >= public.config_int('limit_org_requests_per_week', 50) then
    raise exception 'Your organization''s weekly message requests are used up. They reset over the next few days.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger requests_pace before insert on public.conversations for each row execute function public.requests_pace();

create function public.milestones_pace() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is not null and new.status = 'pending'
     and (select count(*) from public.milestones where owner_id = me and created_at > now() - interval '1 day')
       >= public.config_int('limit_milestones_per_day', 20) then
    perform public.slow_down('submitting milestones');
  end if;
  return new;
end $$;
create trigger milestones_pace before insert on public.milestones for each row execute function public.milestones_pace();

revoke execute on function public.slow_down(text), public.posts_pace(), public.comments_pace(), public.messages_pace(),
  public.requests_pace(), public.milestones_pace() from anon, authenticated, public;
