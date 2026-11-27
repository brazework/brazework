-- Verify mixed action costs against the shared daily balance without an AI provider.
\set QUIET on
begin;
select id as ember_member from auth.users where email = 'ben@forge.test' \gset
select set_config('request.jwt.claim.sub', :'ember_member', true);
delete from public.copilot_usage where user_id = :'ember_member';
delete from public.member_plans where user_id = :'ember_member';

set local role authenticated;
do $$
begin
  if public.ember_take('ask') is distinct from 14 then raise exception 'Ask must cost one credit'; end if;
  if public.ember_take('post') is distinct from 12 then raise exception 'Post must cost two credits'; end if;
  if public.ember_take('group_ask') is distinct from 10 then raise exception 'Group ask must cost two credits'; end if;
  if public.ember_take('chat_summary') is distinct from 8 then raise exception 'Chat summary must cost two credits'; end if;
  if public.ember_take('organize') is distinct from 6 then raise exception 'Organize must cost two credits'; end if;
  if public.ember_take('writeup') is distinct from 3 then raise exception 'Write-up must cost three credits'; end if;
  if public.ember_take('unknown') is distinct from -1 then raise exception 'Unexpected action accepted'; end if;
  if public.ember_take('post') is distinct from 1 then raise exception 'Incorrect remaining balance'; end if;
  if public.ember_take('group_ask') is distinct from -1 then raise exception 'Overspend accepted'; end if;
  if public.copilot_take() is distinct from 0 then raise exception 'Rejection debited the final credit'; end if;
  if public.ember_take('ask') is distinct from -1 then raise exception 'Free cap exceeded'; end if;
end $$;
reset role;

insert into public.member_plans (user_id, status) values (:'ember_member', 'active');
set local role authenticated;
do $$
begin
  if public.ember_take('writeup') is distinct from 32 then
    raise exception 'Plus must carry the same balance and increase the cap to 50';
  end if;
  if has_function_privilege('anon', 'public.ember_take(text)', 'execute') then
    raise exception 'Anonymous role can consume Ember credits';
  end if;
end $$;
reset role;
rollback;
\echo 'Ember credit tests passed'
