-- Tests for supabase/chapters.sql: starting a chapter from your school email under a national network,
-- one chapter per school, nobody can fake the link, the network page (signed out, totals only), and the
-- officers-only weekly roster. Runs in one transaction; rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false), set_config('t.josh', :'josh', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

insert into public.school_domains (domain, school) values ('forge.test', 'Brazework test school') on conflict do nothing;
select id as nsbe from public.organizations where slug = 'nsbe' \gset
select set_config('t.nsbe', :'nsbe', false);

-- Josh's school comes from his email; NSBE National is on the list.
select t.as_('josh'); set local role authenticated;
select t.ok(public.my_school()->>'school' = 'Brazework test school', 'my_school() finds the school from the confirmed email');
select t.ok(public.list_networks() @> jsonb_build_array(jsonb_build_object('slug', 'nsbe', 'short', 'NSBE')), 'NSBE National is a network chapters can join');

-- Josh starts the chapter: named for him, he's the owner, linked to the school and the network.
select public.create_chapter(current_setting('t.nsbe'), 'public') as cid \gset
select set_config('t.cid', :'cid', false);
reset role;
select t.ok((select name = 'NSBE - Brazework test school' and network_id = current_setting('t.nsbe') and school_domain = 'forge.test' from public.communities where id = current_setting('t.cid')), 'the chapter is named "NSBE - <school>" and linked to both');
select t.ok((select role = 'owner' from public.community_members where community_id = current_setting('t.cid') and uid = current_setting('t.josh')::uuid), 'the lead owns it');

-- One chapter per school per network.
select t.as_('maya'); set local role authenticated;
do $$ begin perform public.create_chapter(current_setting('t.nsbe'), 'public'); raise exception 'FAILED: a second chapter at the same school'; exception when raise_exception then raise notice 'ok: one chapter per school (%)', sqlerrm; end $$;
-- Not a network: a company can't be picked.
do $$ begin perform public.create_chapter((select id from public.organizations where name = 'Acme Aerospace'), 'public'); raise exception 'FAILED: a company was used as a network'; exception when raise_exception then raise notice 'ok: only networks can have chapters'; end $$;

-- Nobody can make a club a chapter by editing it, not even its owner.
reset role; select t.as_('ben'); set local role authenticated;
do $$ begin update public.communities set network_id = current_setting('t.nsbe') where id = 'rkt'; raise exception 'FAILED: an owner linked their club to a network by hand'; exception when insufficient_privilege then raise notice 'ok: the network link can''t be edited'; end $$;

-- Signed out: can't start one, but can see the network page.
reset role; set local role anon;
do $$ begin perform public.create_chapter(current_setting('t.nsbe'), 'public'); raise exception 'FAILED: anon started a chapter'; exception when insufficient_privilege then raise notice 'ok: signed-out visitors can''t start a chapter'; end $$;
select t.ok((public.network_page('nsbe')->'chapters'->0->>'name') = 'NSBE - Brazework test school', 'the network page lists the chapter, signed out');
select t.ok((public.network_page('nsbe')->'chapters'->0->>'active')::int = 0, 'no activity yet');
select t.ok(public.network_page('nobody') is null, 'an unknown network is null');

-- Maya joins and posts in the chapter: the page counts her as active.
reset role;
insert into public.community_members (community_id, uid, role) values (current_setting('t.cid'), current_setting('t.maya')::uuid, 'member');
insert into public.posts (author_id, body, community_id, community_name) values (current_setting('t.maya')::uuid, 'Chapter build night: wind tunnel test', current_setting('t.cid'), 'NSBE - Brazework test school');
set local role anon;
select t.ok((public.network_page('nsbe')->'chapters'->0->>'active')::int = 1 and (public.network_page('nsbe')->'chapters'->0->>'posts')::int = 1, 'a member''s post counts: 1 active, 1 post');
select t.ok(public.network_page('nsbe')::text not like '%wind tunnel%', 'the page shows totals, never the posts');

-- The weekly roster: the lead sees every member; a member can't.
reset role; select t.as_('josh'); set local role authenticated;
select t.ok((select count(*) from public.club_member_activity(current_setting('t.cid'))) = 2, 'the lead sees both members');
select t.ok((select cardinality(weeks) = 1 and last_active is not null from public.club_member_activity(current_setting('t.cid')) where uid = current_setting('t.maya')::uuid), 'Maya was active this week');
reset role; select t.as_('maya'); set local role authenticated;
do $$ begin perform * from public.club_member_activity(current_setting('t.cid')); raise exception 'FAILED: a member saw the roster'; exception when insufficient_privilege then raise notice 'ok: only officers see the roster'; end $$;

reset role;
select t.ok(public.chapters_ready(), 'the app can tell the step has run');

rollback;
\echo 'chapters tests: all passed'
