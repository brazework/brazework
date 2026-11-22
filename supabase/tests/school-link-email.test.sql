-- Tests for supabase/school-link-email.sql (step 89, Linear FIX-237): a club's link to its university is
-- asked for from a confirmed address at that university. Runs in one transaction and rolls back. Needs
-- the e2e seed: Ben owns Rocketry Club (rkt), Josh is a member, Maya is a Forge admin, Cara is in no
-- club there.
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.cara', :'cara', false);

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
create function t.email(who text, addr text, confirmed boolean default true) returns void language sql as $$
  update auth.users set email = addr, email_confirmed_at = case when confirmed then now() end where id = current_setting('t.' || who)::uuid
$$;

-- ---------- The address it's asked from ----------
select t.ok(public.email_at_domain('ben@hartford.edu', 'hartford.edu') and public.email_at_domain('Ben@Eng.Hartford.edu', 'hartford.edu'),
  'an address at the school or one of its subdomains counts');
select t.ok(not public.email_at_domain('ben@nothartford.edu', 'hartford.edu') and not public.email_at_domain('ben@hartford.edu.evil.com', 'hartford.edu') and not public.email_at_domain('', 'hartford.edu'),
  'a look-alike domain doesn''t');

-- Ben owns the club, but his address isn't at the school.
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry')$$, 'Ask from your @hartford.edu email');
reset role;
-- An address at another school doesn't count either.
select t.email('ben', 'ben@yale.edu');
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry')$$, '@hartford.edu');
reset role;
-- Nor one at the school that hasn't been confirmed.
select t.email('ben', 'ben@hartford.edu', false);
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry')$$, '@hartford.edu');
reset role;
select t.ok((select count(*) = 0 from public.club_school_links where community_id = 'rkt'), 'nothing was asked without a confirmed school address');

-- ---------- An officer with the school address asks ----------
-- Josh is a member: members can't ask, whatever their address.
select t.email('josh', 'josh@eng.hartford.edu');
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry')$$, 'club''s officers');
reset role;
-- As a moderator he can, from his confirmed department address.
update public.community_members set role = 'moderator' where community_id = 'rkt' and uid = current_setting('t.josh')::uuid;
select t.as_('josh'); set local role authenticated;
select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry');
reset role;
select t.ok((select status = 'pending' and requester_at_school and requester_email = 'josh@eng.hartford.edu' and requested_by = current_setting('t.josh')::uuid
               from public.club_school_links where community_id = 'rkt'), 'the request keeps the confirmed address it came from');

-- ---------- Who stands behind it, for the reviewer ----------
select t.email('ben', 'ben@hartford.edu');
select t.as_('maya'); set local role authenticated;
select t.ok((select array_agg(role order by role) = array['moderator', 'owner'] from public.school_link_backers('rkt')),
  'a Brazework admin sees the officers with a confirmed school address: the owner and the moderator');
reset role;
select t.email('ben', 'ben@forge.test');
select t.as_('maya'); set local role authenticated;
select t.ok((select array_agg(email) = array['josh@eng.hartford.edu'] from public.school_link_backers('rkt')), 'an officer without one isn''t listed');
reset role;
select t.as_('cara'); set local role authenticated;
select t.must_fail($$select * from public.school_link_backers('rkt')$$, 'Only the school or a Brazework admin');
reset role;
select t.as_('ben'); set local role authenticated;
select t.must_fail($$select * from public.school_link_backers('rkt')$$, 'Only the school or a Brazework admin');
reset role;

-- The school's official admin sees them too, and approving gives the club its badge.
select t.as_('maya'); set local role authenticated;
select set_config('t.hartford', public.set_up_school('University of Hartford', 'hartford.edu', 'cara@forge.test'), false);
reset role;
select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) = 1 from public.school_link_backers('rkt')), 'the school''s official admin sees who asked');
select public.decide_school_link('rkt', true, '');
select t.ok((select array_agg(id) = array['rkt'] from public.school_clubs('hartford.edu')), 'approved: the club is listed under the school');
reset role;

select t.ok(public.school_link_email_ready(), 'the app can tell the step has run');

rollback;
\echo 'school-link-email tests: all passed'
