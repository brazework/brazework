-- Tests for supabase/grad-year.sql, acting as real members. Runs in one transaction and rolls back.
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

select t.as_('josh'); set local role authenticated;
update public.profiles set grad_year = 2027 where id = current_setting('t.josh')::uuid;
select t.ok((select grad_year = 2027 from public.profiles where id = current_setting('t.josh')::uuid), 'you can set your own graduation year');
select t.must_fail($$update public.profiles set grad_year = 1900 where id = current_setting('t.josh')::uuid$$, 'check constraint');
update public.profiles set grad_year = null where id = current_setting('t.josh')::uuid;
select t.ok((select grad_year is null from public.profiles where id = current_setting('t.josh')::uuid), 'and clear it (it''s optional)');
-- Someone else's profile: the update matches no rows (row-level security), so nothing changes.
update public.profiles set grad_year = 2030 where id = current_setting('t.ben')::uuid;
reset role;
select t.ok((select grad_year is distinct from 2030 from public.profiles where id = current_setting('t.ben')::uuid), 'you can''t change someone else''s');

-- Other members can read it (it powers the Find builders filter).
update public.profiles set grad_year = 2026 where id = current_setting('t.ben')::uuid;
select t.as_('josh'); set local role authenticated;
select t.ok((select grad_year = 2026 from public.profiles where id = current_setting('t.ben')::uuid), 'members can see each other''s class year');
reset role;

rollback;
\echo 'grad-year tests: all passed'
