-- Torch's numbers (supabase/ember-card-counts.sql): asks and follow-ups counted as they're spent, card
-- outcomes counted by ember_note(), costs unchanged, and only Brazework admins see the totals, which never
-- name a member. Runs as real members, rolled back.
\set QUIET on
begin;
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
delete from public.copilot_usage where user_id in (:'ben', :'maya');
delete from public.member_plans where user_id = :'ben';

-- Ben asks twice, uses a follow-up, and his cards come and go.
select set_config('request.jwt.claim.sub', :'ben', true);
set local role authenticated;
do $$
begin
  if public.ember_take('ask') is distinct from 14 then raise exception 'An ask must still cost one credit'; end if;
  if public.ember_take('follow') is distinct from 14 then raise exception 'A follow-up must still be free'; end if;
  if public.ember_take('ask') is distinct from 13 then raise exception 'The second ask must cost one credit'; end if;
  if public.ember_take('post') is distinct from 11 then raise exception 'A post must still cost two credits'; end if;
  perform public.ember_note('prepared', 3);
  perform public.ember_note('confirmed');
  perform public.ember_note('dismissed', 1);
  perform public.ember_note('failed', 1);
  perform public.ember_note('choices', 1);
  perform public.ember_note('prepared', 500);   -- at most 20 at a time
  perform public.ember_note('prepared', -4);    -- nothing
  perform public.ember_note('verified', 1);     -- not a count: ignored
  perform public.ember_note(null, 1);
  begin
    perform public.admin_torch_metrics();
    raise exception 'A member who is not an admin read the totals';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare u public.copilot_usage;
begin
  select * into u from public.copilot_usage where user_id = current_setting('request.jwt.claim.sub')::uuid;
  if u.asks <> 2 then raise exception 'asks: expected 2, got %', u.asks; end if;
  if u.follows_used <> 1 then raise exception 'follows_used: expected 1, got %', u.follows_used; end if;
  if u.follows_left <> 3 then raise exception 'follows_left: the second ask sets it back to 3, got %', u.follows_left; end if;
  if u.cards_prepared <> 23 then raise exception 'cards_prepared: expected 3 + 20, got %', u.cards_prepared; end if;
  if (u.cards_confirmed, u.cards_dismissed, u.cards_failed, u.choices_offered) <> (1, 1, 1, 1) then raise exception 'outcomes counted wrong'; end if;
  if u.uses <> 4 then raise exception 'credits: expected 4 spent, got %', u.uses; end if;
end $$;

-- A note before any ask today still counts (the row is made for it).
select set_config('request.jwt.claim.sub', :'maya', true);
set local role authenticated;
do $$
begin
  perform public.ember_note('confirmed', 2);
end $$;
reset role;
do $$
begin
  if (select cards_confirmed from public.copilot_usage where user_id = current_setting('request.jwt.claim.sub')::uuid) is distinct from 2 then
    raise exception 'a note with no ask before it was lost';
  end if;
  if (select uses from public.copilot_usage where user_id = current_setting('request.jwt.claim.sub')::uuid) is distinct from 0 then
    raise exception 'a note spent credits';
  end if;
end $$;

-- Maya is a Brazework admin: she sees the totals, with no member named in them.
set local role authenticated;
do $$
declare r jsonb := public.admin_torch_metrics();
begin
  if jsonb_array_length(r->'days') <> 14 then raise exception 'expected 14 days, got %', jsonb_array_length(r->'days'); end if;
  if (r->'last_7'->>'asks')::int < 2 then raise exception 'last_7 asks missing Ben''s'; end if;
  if (r->'last_7'->>'members')::int < 1 then raise exception 'last_7 members: Ben asked'; end if;
  if (r->'last_7'->>'confirmed')::int < 3 then raise exception 'last_7 confirmed: Ben 1 + Maya 2'; end if;
  if r::text like '%' || current_setting('request.jwt.claim.sub') || '%' then raise exception 'the totals name a member'; end if;
  if r::text ~ '[0-9a-f]{8}-[0-9a-f]{4}-' then raise exception 'the totals carry an id'; end if;
  if has_function_privilege('anon', 'public.ember_note(text, integer)', 'execute') then raise exception 'anonymous can count'; end if;
  if has_function_privilege('anon', 'public.admin_torch_metrics()', 'execute') then raise exception 'anonymous can read the totals'; end if;
end $$;
reset role;

-- Clients still can't read the usage table directly.
set local role authenticated;
do $$
begin
  if exists (select 1 from public.copilot_usage) then raise exception 'members can read the usage table'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;
rollback;
\echo 'Ember card count tests passed'
