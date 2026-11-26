-- Free follow turns (supabase/ember-follow.sql): 3 after each paid ask, none without one, none carried
-- to the next day, and a follow never touches the daily credits. Runs as a real member, rolled back.
\set QUIET on
begin;
select id as ember_member from auth.users where email = 'ben@forge.test' \gset
select set_config('request.jwt.claim.sub', :'ember_member', true);
delete from public.copilot_usage where user_id = :'ember_member';
delete from public.member_plans where user_id = :'ember_member';

set local role authenticated;
do $$
begin
  if public.ember_take('follow') is distinct from -1 then raise exception 'A follow with no ask before it was allowed'; end if;
  if public.ember_take('ask') is distinct from 14 then raise exception 'An ask must still cost one credit'; end if;
  if public.ember_take('follow') is distinct from 14 then raise exception 'A follow must be free'; end if;
  if public.ember_take('follow') is distinct from 14 then raise exception 'The second follow must be free'; end if;
  if public.ember_take('follow') is distinct from 14 then raise exception 'The third follow must be free'; end if;
  if public.ember_take('follow') is distinct from -1 then raise exception 'A fourth follow was allowed'; end if;
  -- Another ask gives 3 again, not 3 more on top of what was left.
  if public.ember_take('ask') is distinct from 13 then raise exception 'The second ask must cost one credit'; end if;
  if public.ember_take('follow') is distinct from 13 then raise exception 'Follows must come back after an ask'; end if;
  if public.ember_take('ask') is distinct from 12 then raise exception 'The third ask must cost one credit'; end if;
end $$;
reset role;
do $$
begin
  if (select follows_left from public.copilot_usage where user_id = current_setting('request.jwt.claim.sub')::uuid) is distinct from 3 then
    raise exception 'Follows must be set to 3 by an ask, not added up';
  end if;
end $$;

-- Other actions leave the follows alone.
set local role authenticated;
do $$
begin
  if public.ember_take('post') is distinct from 10 then raise exception 'A post must still cost two credits'; end if;
  if public.ember_take('follow') is distinct from 10 then raise exception 'A post must not take away the follows'; end if;
end $$;
reset role;

-- Yesterday's follows are gone today.
update public.copilot_usage set day = day - 1 where user_id = :'ember_member';
set local role authenticated;
do $$
begin
  if public.ember_take('follow') is distinct from -1 then raise exception 'A follow carried over to the next day'; end if;
end $$;
reset role;

-- Spending the last credit on an ask still leaves its follows.
delete from public.copilot_usage where user_id = :'ember_member';
insert into public.copilot_usage (user_id, day, uses) values (:'ember_member', (now() at time zone 'UTC')::date, 14);
set local role authenticated;
do $$
begin
  if public.ember_take('ask') is distinct from 0 then raise exception 'The last credit must go on the ask'; end if;
  if public.ember_take('follow') is distinct from 0 then raise exception 'Follows must work with no credits left'; end if;
  if public.ember_take('ask') is distinct from -1 then raise exception 'An ask with no credits left was allowed'; end if;
  if has_function_privilege('anon', 'public.ember_take(text)', 'execute') then raise exception 'Anonymous role can take follows'; end if;
end $$;
reset role;
rollback;
\echo 'Ember follow tests passed'
