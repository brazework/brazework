-- Tests for supabase/tool-signer.sql: work a person signed through a vouch (vouches.sql answer_vouch)
-- names that person on the résumé (mcp_resume) and in company search (mcp_talent_rows), as the review
-- packet does; work a club signed still names its officer, then the club. Rolls back.
\set QUIET on
begin;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as cara from auth.users where email = 'cara@forge.test' \gset
select set_config('t.ben', :'ben', false), set_config('t.cara', :'cara', false);

create schema t;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.as_(who text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', current_setting('t.' || who), true); end $$;
-- The signer a line names, from the résumé or from the company search rows.
create function t.cv_signer(id text) returns text language sql as $$
  select s->>'signed_by' from jsonb_array_elements(public.mcp_resume(repeat('b', 64))->'projects') p, jsonb_array_elements(p->'signed') s where s->>'milestone_id' = id $$;
create function t.row_of(id text) returns jsonb language sql as $$
  select x from jsonb_array_elements(public.mcp_talent_rows(repeat('c', 64))->'rows') x where x->>'id' = id $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

select t.as_('cara'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('c', 64), 'forge_cccccc', array['read']) is not null as r1 \gset
reset role; select t.as_('ben'); set local role authenticated;
select public.create_api_token('Claude Code', repeat('b', 64), 'forge_bbbbbb', array['read']) is not null as r2 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
update public.organizations set verification_status = 'verified' where domain = 'forge.test';

-- m1 as answer_vouch leaves it when a professor signs, here with the name column empty, as on the demo.
update public.milestones set vouched_by = 'Dr. Elena Ruiz, Assistant Professor · stateu.edu', reviewer_name = '', reviewer_role = 'professor' where id = 'm1';

-- ---------- the résumé ----------
select t.ok(t.cv_signer('m1') = 'Dr. Elena Ruiz, Assistant Professor · stateu.edu', 'the résumé names the professor who signed, never blank');
select t.ok(t.cv_signer('m2') = 'Maya Patel', '... and the officer who signed club work, as before');
update public.milestones set reviewer_name = '' where id = 'm2';
select t.ok(t.cv_signer('m2') = 'Robotics Society', '... else the club');

-- ---------- company search ----------
select t.ok(t.row_of('m1')->>'vouched_by' = 'Dr. Elena Ruiz, Assistant Professor · stateu.edu', 'company search rows carry who vouched');
select t.ok(t.row_of('m2')->>'vouched_by' = '', '... and an empty one for club-signed work');
select t.ok(t.row_of('m1') ? 'reviewer_name' and t.row_of('m1') ? 'community_name', '... alongside the fields /talent reads');

select t.ok(public.tool_signer_ready(), 'tool_signer_ready()');

select 'tool-signer: all passed' as passed;
rollback;
