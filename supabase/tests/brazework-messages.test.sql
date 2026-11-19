-- Tests for supabase/brazework-messages.sql: no error the database raises names Forge any more, the
-- messages members and admins see say Brazework, and the team's events are hosted by Brazework.
-- Needs the e2e seed (Josh is a member and not an admin; Rocketry Club is rkt). Rolls back.
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.josh', :'josh', false);

create schema t;
grant usage on schema t to authenticated;
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
grant execute on all functions in schema t to authenticated;

-- Every function in the database, not only the ones this step redefines: a new message that says
-- Forge fails here too.
select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc ~ 'raise\s+exception\s+''[^'']*\mForge\M'
), 'no function raises an error that says Forge');
select t.ok((select name from public.organizations where type = 'forge' limit 1) = 'Brazework', 'the team''s events are hosted by Brazework');
select t.ok(not exists (select 1 from public.organizations where name = 'Forge'), 'no organization is still called Forge');
select t.ok(public.brazework_messages_ready(), 'the step is in');

-- What a member sees.
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.block_user('00000000-0000-0000-0000-000000000000')$$, 'That person isn''t on Brazework');
select t.must_fail($$select public.request_club_claim('no-such-club', 'President', 'The club page lists me as president.')$$, 'That club isn''t on Brazework');
select t.must_fail($$select public.submit_feedback('idea', 'nowhere', 'A long enough piece of feedback')$$, 'which part of Brazework');
-- What someone who isn't an admin sees on the admin tools.
select t.must_fail($$select public.admin_metrics()$$, 'Brazework admins only');
select t.must_fail($$select public.admin_retention()$$, 'Brazework admins only');
reset role;

-- The posting pace, word for word.
select t.must_fail($$select public.slow_down('posting')$$, 'You''re posting faster than Brazework allows');

rollback;
\echo 'brazework-messages tests: all passed'
