-- Tests for supabase/redacted-proof.sql: only the owner writes a private milestone's public line; it
-- can't be the private title, markup, or set on public work; other members see the line with who stood
-- behind it in general terms and the month, and never the title, project, signer or club; only signed
-- work shows. Runs in one transaction; rolls back.
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
create function t.refused(call text, state text, what text) returns void language plpgsql as $$
begin
  execute call;
  raise exception 'FAILED: % (it was allowed)', what;
exception when others then
  if sqlstate = state then raise notice 'ok: %', what; else raise exception 'FAILED: % (got %: %)', what, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- ---------- Writing the line ----------
-- m3 is Ben's verified milestone on his private project ("Stealth side project"), verified by Maya for Rocketry Club.
select t.as_('ben'); set local role authenticated;
select t.ok(public.set_public_line('m3', '  Shipped   a payments migration ') = 'Shipped a payments migration', 'the owner writes a line (spaces tidied)');
select t.refused($$select public.set_public_line('m1', 'Ran a static fire')$$, 'P0001', 'public work doesn''t need one');
select t.refused($$select public.set_public_line('m3', 'Private milestone')$$, 'P0001', 'it can''t be the private title');
select t.refused($$select public.set_public_line('m3', repeat('x', 141))$$, 'P0001', 'one line, 140 characters');
select t.refused($$select public.set_public_line('m3', 'Shipped <b>it</b>')$$, 'P0001', 'no markup');
select t.refused($$update public.milestones set public_line = 'sneaky' where id = 'm3'$$, '42501', 'nobody writes the column directly');
reset role;
select t.as_('maya'); set local role authenticated;
select t.refused($$select public.set_public_line('m3', 'Maya''s words')$$, '42501', 'only the owner writes it, not the club officer who verified it');
reset role;

-- A private milestone a professor vouched for.
select t.as_('ben'); set local role authenticated;
insert into public.milestones (project_id, community_id, title, detail, evidence, private) values ('p1', null, 'Acme pricing engine v2 cutover', 'Confidential', 'https://example.com/internal', true);
reset role;
select id as pv from public.milestones where title = 'Acme pricing engine v2 cutover' \gset
select t.as_('ben'); set local role authenticated;
select public.request_vouch(:'pv', 'prof.lee@utexas.edu', 'professor', repeat('7', 64)) is not null as asked \gset
reset role;
set local role anon;
select public.answer_vouch(repeat('7', 64), true, 'Dr. Priya Lee', 'Assistant Professor', 'I reviewed the cutover plan and watched the rollout in our lab.', 'His advisor') as ans \gset
reset role;
select t.as_('ben'); set local role authenticated;
select public.set_public_line(:'pv', 'Led a pricing system cutover') is not null as set2 \gset
reset role;

-- ---------- What other members see ----------
select t.as_('maya'); set local role authenticated;
select public.redacted_proof(:'ben'::uuid) as r \gset
select t.ok(jsonb_array_length(:'r'::jsonb) = 2, 'two lines show');
select t.ok((select x->>'line' = 'Shipped a payments migration' and x->'signer' = '{"kind": "club"}'::jsonb and x->>'month' ~ '^\d{4}-\d{2}$' from jsonb_array_elements(:'r'::jsonb) x where x->>'id' = 'm3'),
  'a club-verified one: the line, "verified by a club", and the month');
select t.ok((select x->'signer' = '{"org": "university", "kind": "vouch", "role": "professor"}'::jsonb from jsonb_array_elements(:'r'::jsonb) x where x->>'id' = :'pv'),
  'a vouched one: a professor at a university');
select t.ok(position('Private milestone' in :'r') = 0 and position('Stealth' in :'r') = 0 and position('Acme pricing' in :'r') = 0
  and position('Rocketry' in :'r') = 0 and position('Maya' in :'r') = 0 and position('Priya' in :'r') = 0 and position('utexas' in :'r') = 0 and position('example.com' in :'r') = 0,
  'never the title, project, club, signer, domain or evidence');
reset role;
select t.as_('josh'); set local role authenticated;
select t.ok(jsonb_array_length(public.redacted_proof(:'ben'::uuid)) = 2, 'any member sees the lines');
select t.ok((select count(*) = 0 from public.milestones where id = 'm3'), 'while the private milestone itself stays closed to them');
reset role;

-- Only signed work shows.
update public.milestones set status = 'revoked' where id = 'm3';
select t.as_('maya'); set local role authenticated;
select t.ok(jsonb_array_length(public.redacted_proof(:'ben'::uuid)) = 1, 'a revoked milestone''s line stops showing');
reset role;

-- Clearing it.
select t.as_('ben'); set local role authenticated;
select t.ok(public.set_public_line(:'pv', '') = '', 'the owner can clear it');
reset role;
select t.as_('maya'); set local role authenticated;
select t.ok(public.redacted_proof(:'ben'::uuid) = '[]'::jsonb, 'and then nothing shows');
reset role;

set local role anon;
select t.refused(format($$select public.redacted_proof(%L)$$, :'ben'), '42501', 'signed out, nothing');
reset role;

select 'redacted-proof: all passed' as passed;
rollback;
