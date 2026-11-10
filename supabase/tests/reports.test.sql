-- Tests for supabase/reports-more.sql, acting as real members. Runs in one transaction and rolls
-- back. Needs the e2e seed (Ben owns project p1 and milestone m1; Maya is a Forge admin).
\set QUIET on
begin;

select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as maya from auth.users where email = 'maya@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false), set_config('t.maya', :'maya', false);

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

-- Josh reports Ben's project and milestone; the owner is recorded, not chosen by the reporter.
select t.as_('josh'); set local role authenticated;
insert into public.content_reports (kind, target_id, reason, detail) values ('project', 'p1', 'misinformation', 'The photos are from another team''s stand.');
insert into public.content_reports (kind, target_id, reason) values ('milestone', 'm1', 'other');
select t.must_fail($$insert into public.content_reports (kind, target_id, reason) values ('project', 'nope', 'spam')$$, 'no longer there');
select t.must_fail($$insert into public.content_reports (kind, target_id, reason) values ('project', 'p1', 'spam')$$, 'duplicate key');
reset role;
select t.ok((select count(*) = 2 and bool_and(reported = current_setting('t.ben')::uuid and status = 'open') from public.content_reports where reporter = current_setting('t.josh')::uuid and kind in ('project', 'milestone')), 'reports name the owner and start open');

-- Ben can't report his own work, can't see Josh's reports, and can't resolve them.
select t.as_('ben'); set local role authenticated;
select t.must_fail($$insert into public.content_reports (kind, target_id, reason) values ('project', 'p1', 'spam')$$, 'can''t report yourself');
select t.ok((select count(*) = 0 from public.content_reports where kind = 'project' and target_id = 'p1'), 'the reported member can''t see who reported them');
select t.must_fail($$select public.resolve_report((select max(id) from public.content_reports), 'dismissed')$$, 'Forge admins only');

-- A Forge admin sees them with detail and resolves one.
reset role; select t.as_('maya'); set local role authenticated;
select t.ok((select count(*) >= 2 from public.content_reports where kind in ('project', 'milestone')), 'Forge admins see every report');
select t.ok((select detail like '%another team%' from public.content_reports where kind = 'project' and target_id = 'p1'), 'with the reporter''s detail');
select t.ok(public.open_reports() >= 2, 'open reports are counted');
select public.resolve_report((select id from public.content_reports where kind = 'project' and target_id = 'p1'), 'actioned');
reset role;
select t.ok((select status = 'actioned' and resolved_by = current_setting('t.maya')::uuid and resolved_at is not null from public.content_reports where kind = 'project' and target_id = 'p1'), 'resolved, with who and when');

rollback;
\echo 'reports tests: all passed'
