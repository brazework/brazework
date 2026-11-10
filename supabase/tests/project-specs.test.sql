-- Tests for supabase/project-specs.sql. Runs in one transaction and rolls back. Needs the e2e seed
-- (Ben owns project p1; Josh doesn't).
\set QUIET on
begin;
select id as josh from auth.users where email = 'josh@forge.test' \gset
select id as ben from auth.users where email = 'ben@forge.test' \gset
select set_config('t.josh', :'josh', false), set_config('t.ben', :'ben', false);
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

insert into public.project_details (project_id) values ('p1') on conflict do nothing;
select t.as_('ben'); set local role authenticated;
update public.project_details set specs = '[{"label":"Peak thrust","value":"2 kN"},{"label":"Load cell","value":"S-type, 500 kg"}]' where project_id = 'p1';
select t.ok((select jsonb_array_length(specs) = 2 from public.project_details where project_id = 'p1'), 'the owner saves specs');
select t.must_fail($$update public.project_details set specs = '[{"label":"","value":"x"}]' where project_id = 'p1'$$, 'project_details_specs_ok');
select t.must_fail($$update public.project_details set specs = '[{"label":"a","value":"b","x":1}]' where project_id = 'p1'$$, 'project_details_specs_ok');
select t.must_fail($$update public.project_details set specs = (select jsonb_agg(jsonb_build_object('label', 'L' || g, 'value', 'v')) from generate_series(1, 17) g) where project_id = 'p1'$$, 'project_details_specs_ok');
reset role; select t.as_('josh'); set local role authenticated;
update public.project_details set specs = '[]' where project_id = 'p1';
reset role;
select t.ok((select jsonb_array_length(specs) = 2 from public.project_details where project_id = 'p1'), 'others can''t change them');
select t.as_('josh'); set local role authenticated;
select t.ok((select specs->0->>'label' = 'Peak thrust' from public.project_details where project_id = 'p1'), 'and anyone can read a public project''s specs');
reset role;
rollback;
\echo 'project-spec tests: all passed'
