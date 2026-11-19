-- Tests for supabase/tool-talent.sql: company search over MCP reads exactly what /talent reads, only
-- for admins of a verified company or school; and a member's résumé lists their own signed work
-- with links anyone can open. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false), set_config('t.josh', :'josh', false);

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

select t.as_('cara'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('c', 64), 'forge_cccccc', array['read']) is not null as r1 \gset
reset role; select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('b', 64), 'forge_bbbbbb', array['read']) is not null as r2 \gset
reset role; select t.as_('josh'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('1', 64), 'forge_111111', array['read']) is not null as r3 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
update public.organizations set verification_status = 'verified' where domain = 'forge.test';

-- ---------- company search ----------
select public.mcp_talent_rows(repeat('c', 64)) as rows \gset
select set_config('t.rows', :'rows', false);
select t.ok(current_setting('t.rows')::jsonb->'org'->>'name' = 'Acme Aerospace', 'a verified company''s admin gets /talent''s rows');
-- Exactly what the admin could read in the app: the same rows /talent's query returns as Cara.
select t.as_('cara'); set local role authenticated;
select t.ok((select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(current_setting('t.rows')::jsonb->'rows') x)
          = (select array_agg(id order by id) from public.milestones where status = 'verified' and not private), '... exactly the public signed work Cara can read in the app');
reset role;
select t.ok(not exists (select 1 from jsonb_array_elements(current_setting('t.rows')::jsonb->'rows') x where x->>'id' = 'm3'), '... never a private milestone or one on a private project');
select t.ok((select bool_and(x ? 'grad_year' and x ? 'open_to' and not x ? 'email') from jsonb_array_elements(current_setting('t.rows')::jsonb->'people') x), '... with the profile fields members see, and no email');
select t.refused($$select public.mcp_talent_rows(repeat('1', 64))$$, 'P0001', 'a member who isn''t a company admin can''t search');
update public.organizations set verification_status = 'suspended' where domain = 'forge.test';
select t.refused($$select public.mcp_talent_rows(repeat('c', 64))$$, 'P0001', 'nor an admin of a suspended company');

-- ---------- résumé ----------
select public.mcp_resume(repeat('b', 64)) as cv \gset
select set_config('t.cv', :'cv', false);
select t.ok(current_setting('t.cv')::jsonb->>'name' = 'Ben Cho', 'Ben''s résumé');
select t.ok((select bool_and(s->>'level' = 'signed' and s->>'signed_by' is not null and s->>'link' like '/%')
             from jsonb_array_elements(current_setting('t.cv')::jsonb->'projects') p, jsonb_array_elements(p->'signed') s), '... each line signed by someone, with a link');
select t.ok(not exists (select 1 from jsonb_array_elements(current_setting('t.cv')::jsonb->'projects') p, jsonb_array_elements(p->'signed') s where s->>'milestone_id' = 'm3'),
  '... and nothing Ben keeps private');
update public.milestones set shared_at = now() where id = 'm1';
select t.ok((select s->>'link' = '/p/m1' and (s->>'public_card')::boolean from jsonb_array_elements(public.mcp_resume(repeat('b', 64))->'projects') p, jsonb_array_elements(p->'signed') s where s->>'milestone_id' = 'm1'),
  'a shared result links to its public proof card');
-- Once the verify pages step has run (verify-links.sql), signed public work links to /v/<id>.
do $$ begin
  if to_regprocedure('public.public_verify(text)') is null then
    execute 'create function public.public_verify(p_id text) returns jsonb language sql as $f$ select null::jsonb $f$';
  end if;
end $$;
select t.ok((select s->>'link' = '/v/m1' from jsonb_array_elements(public.mcp_resume(repeat('b', 64))->'projects') p, jsonb_array_elements(p->'signed') s where s->>'milestone_id' = 'm1'),
  'with verify pages, a signed public result links to its verify page');

-- ---------- follow ----------
select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Desktop', repeat('d', 64), 'forge_dddddd', array['post']) is not null as r9 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
delete from public.follows where follower = :'ben' and target = :'cara';
select t.ok((public.mcp_act(repeat('d', 64), 'follow', format('{"person_id":"%s"}', current_setting('t.cara'))::jsonb, true)->>'drafted')::boolean, 'a follow can be left as a card');
select t.ok(public.mcp_act(repeat('d', 64), 'follow', format('{"person_id":"%s"}', current_setting('t.cara'))::jsonb, false)->>'status' = 'following', 'a posting token follows Cara for Ben');
select t.refused(format($$select public.mcp_act(repeat('d', 64), 'follow', '{"person_id":"%s"}', false)$$, current_setting('t.cara')), 'P0001', 'not twice');
select t.refused(format($$select public.mcp_act(repeat('d', 64), 'follow', '{"person_id":"%s"}', false)$$, current_setting('t.ben')), 'P0001', 'not yourself');
select t.ok(public.tool_talent_ready(), 'tool_talent_ready()');

select 'tool-talent: all passed' as passed;
rollback;
