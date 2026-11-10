-- Tests for supabase/email-digest.sql. Runs in one transaction and rolls back. Needs the e2e seed.
\set QUIET on
begin;
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.josh', :'josh', false);
create schema t;
grant usage on schema t to authenticated, service_role;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
create function t.must_fail(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then raise exception 'FAILED: expected "%" but got "%" for: %', needle, sqlerrm, q; end if;
    return;
  end;
  raise exception 'FAILED: expected an error ("%") for: %', needle, q;
end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant execute on all functions in schema t to authenticated, service_role;

-- Members can't read the address list.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select * from public.digest_recipients()$$, 'permission denied');
reset role; set local role service_role;
select t.ok((select count(*) >= 4 from public.digest_recipients()), 'every onboarded member gets it by default');
reset role;

-- Turning it off removes you; this week's send is recorded once.
select t.as_('josh'); set local role authenticated;
select public.save_email_prefs(false);
select t.ok((select not weekly_digest from public.email_prefs where user_id = current_setting('t.josh')::uuid), 'Josh turned it off');
reset role; set local role service_role;
select t.ok((select count(*) = 0 from public.digest_recipients() where user_id = current_setting('t.josh')::uuid), 'and isn''t on the list');
reset role; select t.as_('josh'); set local role authenticated;
select public.save_email_prefs(true);
reset role;
insert into public.digest_sends (user_id, week) values (current_setting('t.josh')::uuid, date_trunc('week', now())::date);
set local role service_role;
select t.ok((select count(*) = 0 from public.digest_recipients() where user_id = current_setting('t.josh')::uuid), 'already sent this week: not again');
reset role;
rollback;
\echo 'email-digest tests: all passed'
