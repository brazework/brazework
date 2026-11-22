-- Exercise the same RPC used by web, mobile, and group chat without calling an AI provider.
\set QUIET on
begin;
select id as ember_member from auth.users where email = 'ben@forge.test' \gset
select set_config('request.jwt.claim.sub', :'ember_member', true);

delete from public.copilot_usage where user_id = :'ember_member';
delete from public.member_plans where user_id = :'ember_member';
insert into public.copilot_usage (user_id, day, uses)
values (:'ember_member', (now() at time zone 'UTC')::date - 1, 25);

set local role authenticated;
do $$
declare request_number integer; remaining integer;
begin
  for request_number in 1..15 loop
    remaining := public.copilot_take();
    if remaining is distinct from 15 - request_number then
      raise exception 'Free request % returned %', request_number, remaining;
    end if;
  end loop;
  if public.copilot_take() is distinct from -1 then
    raise exception 'Free account can exceed the daily cap';
  end if;
end $$;
reset role;

insert into public.member_plans (user_id, status) values (:'ember_member', 'active');
set local role authenticated;
do $$
declare request_number integer; remaining integer;
begin
  for request_number in 16..50 loop
    remaining := public.copilot_take();
    if remaining is distinct from 50 - request_number then
      raise exception 'Plus request % returned %', request_number, remaining;
    end if;
  end loop;
  if public.copilot_take() is distinct from -1 then
    raise exception 'Plus account can exceed the daily cap';
  end if;
end $$;
reset role;

update public.member_plans
set current_period_end = now() - interval '1 second'
where user_id = :'ember_member';
update public.copilot_usage set uses = 14
where user_id = :'ember_member' and day = (now() at time zone 'UTC')::date;
set local role authenticated;
do $$
begin
  if public.copilot_take() is distinct from 0 or public.copilot_take() is distinct from -1 then
    raise exception 'Expired Plus account did not fall back to Free';
  end if;
end $$;
reset role;

do $$
begin
  if has_function_privilege('anon', 'public.copilot_take()', 'execute') then
    raise exception 'Anonymous role can consume Ember requests';
  end if;
end $$;
rollback;
\echo 'Ember allowance tests passed'
