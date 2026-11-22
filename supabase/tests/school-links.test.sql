-- Tests for supabase/school-links.sql (step 56), acting as real members. Runs in one transaction and
-- rolls back. Needs the e2e seed: Ben owns Rocketry Club (rkt), Josh is a member, Maya is a Forge
-- admin, Cara is in no club there.
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

-- ---------- Asking ----------
-- Since step 89 (school-link-email.sql) asking needs a confirmed address at the school: give Ben one
-- for this test (rolled back with the rest).
update auth.users set email = 'ben@hartford.edu', email_confirmed_at = coalesce(email_confirmed_at, now()) where id = current_setting('t.ben')::uuid;
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry')$$, 'club''s officers');
reset role;

select t.as_('ben'); set local role authenticated;
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'example.com', 'https://hartford.edu/clubs/rocketry')$$, 'academic domain');
select t.must_fail($$select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'not a link')$$, 'student-organization directory');
select public.request_school_link('rkt', 'University of Hartford', 'https://www.hartford.edu/student-life', 'https://hartford.edu/clubs/rocketry');
select t.ok((select status = 'pending' and school_domain = 'hartford.edu' and requester_at_school from public.club_school_links where community_id = 'rkt'),
  'a request is pending, the website is reduced to its domain, and the requester is at the school');
select t.must_fail($$select public.decide_school_link('rkt', true)$$, 'Only the school or a Brazework admin');
reset role;

-- Someone outside the club can't see a pending request, and the club isn't listed yet.
select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) = 0 from public.club_school_links where community_id = 'rkt'), 'a pending request is private to the club and its reviewers');
select t.ok((select count(*) = 0 from public.school_clubs('hartford.edu')), 'an unverified club isn''t listed under the school');
reset role;

-- ---------- Deciding: a Brazework admin, while the school has no official account ----------
select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) = 1 from public.club_school_links where community_id = 'rkt' and status = 'pending'), 'a Brazework admin sees the request');
select public.decide_school_link('rkt', true, '');
reset role;
select t.ok((select status = 'verified' and decided_by = current_setting('t.maya')::uuid from public.club_school_links where community_id = 'rkt'), 'approved, and who approved it is recorded');
select t.ok((select count(*) = 1 from public.notifications where user_id = current_setting('t.ben')::uuid and community_id = 'rkt' and snippet like '%verified club of University of Hartford%'), 'the club''s owner is told');

select t.as_('cara'); set local role authenticated;
select t.ok((select count(*) = 1 from public.club_school_links where community_id = 'rkt' and status = 'verified'), 'a verified link is public (the badge)');
select t.ok((select array_agg(id) = array['rkt'] from public.school_clubs('hartford.edu')), 'and the club is listed under the school');
reset role;

-- ---------- The school itself, once Brazework has set up its official account ----------
-- Schools can't sign themselves up; nor can a member set up a school.
select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.create_organization('school', 'University of Hartford', 'hartford.edu', '', '', '{}')$$, 'set up with the Brazework team');
select t.must_fail($$select public.set_up_school('University of Hartford', 'hartford.edu', 'cara@forge.test')$$, 'Brazework admins only');
reset role;
select t.as_('ben'); set local role authenticated;
select public.request_school_link('rkt', 'University of Hartford', 'hartford.edu', 'https://hartford.edu/clubs/rocketry-2');
reset role;
select t.ok((select status = 'pending' from public.club_school_links where community_id = 'rkt'), 'asking again starts a new request');
select t.as_('cara'); set local role authenticated;
select t.must_fail($$select public.decide_school_link('rkt', false, 'Not ours')$$, 'Only the school or a Brazework admin');
reset role;
-- A Brazework admin sets up Hartford's official account with Cara as its admin; now she decides for it.
select t.as_('maya'); set local role authenticated;
select set_config('t.hartford', public.set_up_school('University of Hartford', 'hartford.edu', 'cara@forge.test'), false);
reset role;
select t.ok((select official and type = 'school' from public.organizations where id = current_setting('t.hartford')), 'the school''s account is official');
select t.as_('cara'); set local role authenticated;
select t.must_fail($$update public.organizations set official = false where id = current_setting('t.hartford')$$, 'permission denied');
select t.ok((select count(*) = 1 from public.club_school_links where community_id = 'rkt'), 'the official school''s admin sees the request');
select public.decide_school_link('rkt', false, 'Please use the link from the student activities office.');
reset role;
select t.ok((select status = 'declined' and decision_note like 'Please use%' from public.club_school_links where community_id = 'rkt'), 'the school declines, with a note');

-- ---------- Leaving ----------
select t.as_('josh'); set local role authenticated;
select t.must_fail($$select public.remove_school_link('rkt')$$, 'owner or an admin');
reset role;
select t.as_('ben'); set local role authenticated;
select public.remove_school_link('rkt');
reset role;
select t.ok((select count(*) = 0 from public.club_school_links where community_id = 'rkt'), 'the club''s owner removes the link');

select t.ok(public.school_links_ready(), 'the app can tell the step has run');

rollback;
\echo 'school-links tests: all passed'
