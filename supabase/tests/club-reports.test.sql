-- Tests for supabase/club-reports.sql. Runs in one transaction and rolls back. Needs the e2e seed
-- (Rocketry Club "rkt": Ben owner, Josh member; m1 is public verified work, m3 is private).
\set QUIET on
begin;
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false);
create schema t;
grant usage on schema t to anon, authenticated;
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
grant execute on all functions in schema t to anon, authenticated;

select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.club_report_link('rkt')$$, 'owner and admins');
reset role; select t.as_('ben'); set local role authenticated;
select set_config('t.tok', public.club_report_link('rkt'), false);
select t.ok(public.club_report_link('rkt') = current_setting('t.tok'), 'one live link per club');
select t.ok(char_length(current_setting('t.tok')) = 32, 'the link is a long random token');

-- Anyone with the link (not signed in) sees public information only.
reset role; set local role anon;
select set_config('t.r', public.public_club_report(current_setting('t.tok'))::text, false);
select t.ok((current_setting('t.r')::jsonb #>> '{club,name}') = 'Rocketry Club', 'the report names the club');
select t.ok(current_setting('t.r') like '%Static fire at 1.2 kN%', 'public verified work is in it');
select t.ok(current_setting('t.r') not like '%Private milestone%', 'private work is not');
select t.ok(public.public_club_report('not-a-token') is null, 'a wrong token shows nothing');

-- Revoking stops the link at once.
reset role; select t.as_('ben'); set local role authenticated;
select public.revoke_club_report_link('rkt');
reset role; set local role anon;
select t.ok(public.public_club_report(current_setting('t.tok')) is null, 'a revoked link shows nothing');
reset role;
rollback;
\echo 'club-report tests: all passed'
