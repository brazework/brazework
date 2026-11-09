-- What the UI tests need on top of web/e2e/seed.sql: Maya has messaged Josh (an active conversation).
-- Local test stack only. Safe to run more than once.
do $$
declare josh uuid := (select id from auth.users where email = 'josh@forge.test');
        maya uuid := (select id from auth.users where email = 'maya@forge.test');
        a uuid; b uuid; cid text;
begin
  a := least(josh, maya); b := greatest(josh, maya);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.conversations (user_a, user_b, started_by, status, people)
    values (a, b, maya, 'active', jsonb_build_object(
      josh::text, (select jsonb_build_object('firstName', first_name, 'lastName', last_name, 'headline', headline) from public.profiles where id = josh),
      maya::text, (select jsonb_build_object('firstName', first_name, 'lastName', last_name, 'headline', headline) from public.profiles where id = maya)))
    returning id into cid;
  else
    update public.conversations set status = 'active' where id = cid;
  end if;
  if not exists (select 1 from public.messages where conversation_id = cid and body = 'Are you coming to launch day?') then
    insert into public.messages (conversation_id, sender_id, body) values (cid, maya, 'Are you coming to launch day?');
  end if;
end $$;

-- An upcoming in-person club event (for the Events tab and its map).
do $$
declare club text := (select id from public.communities where name = 'Rocketry Club');
        ben uuid := (select id from auth.users where email = 'ben@forge.test');
begin
  if club is not null and not exists (select 1 from public.events where title = 'Saturday static fire' and ends_at > now()) then
    insert into public.events (community_id, title, description, type, format, location, topic, starts_at, ends_at, created_by)
    values (club, 'Saturday static fire', 'Bring eye protection. We test the new motor on the stand, then pizza.', 'Workshop', 'In person',
            'Bayside Park, San Francisco, CA', 'Rocketry', date_trunc('hour', now()) + interval '3 days', date_trunc('hour', now()) + interval '3 days 3 hours', ben);
  end if;
end $$;
