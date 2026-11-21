-- Tests for supabase/ember-memory.sql: a member saves, reads and forgets their own memories; nobody
-- else reads, writes or deletes them; signed-out callers get nothing; at most 50; too long is refused;
-- deleting the account deletes them. Rolls back.
\set QUIET on
begin;
create schema t;
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
create function t.as_(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, true); end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

select id as ben from auth.users where email = 'ben@forge.test' \gset
select id as josh from auth.users where email = 'josh@forge.test' \gset
select t.ok(public.ember_memory_ready(), 'the step has run');

-- Ben saves and reads his own.
select t.as_(:'ben'); set local role authenticated;
insert into public.ember_memories (body) values ('Aiming for robotics internships in Boston');
select t.ok((select count(*) from public.ember_memories) = 1, 'he reads his own');
select t.must_fail($$insert into public.ember_memories (body) values ('   ')$$, 'check');
select t.must_fail(format($$insert into public.ember_memories (body) values (%L)$$, repeat('x', 201)), 'check');
select t.must_fail($$update public.ember_memories set body = 'changed'$$, 'permission denied');
reset role;
select id as mem from public.ember_memories where user_id = :'ben' \gset

-- Josh can't read, add for, or delete Ben's.
select t.as_(:'josh'); set local role authenticated;
select t.ok((select count(*) from public.ember_memories) = 0, 'another member reads none of his');
select t.must_fail(format($$insert into public.ember_memories (user_id, body) values (%L, 'planted')$$, :'ben'), 'row-level security');
delete from public.ember_memories where id = :'mem';
reset role;
select t.ok(exists (select 1 from public.ember_memories where id = :'mem'), 'another member deleted nothing');

-- Signed out: nothing.
set local role anon;
select t.must_fail($$select * from public.ember_memories$$, 'permission denied');
reset role;

-- At most 50.
insert into public.ember_memories (user_id, body) select :'ben', 'note ' || g from generate_series(2, 50) g;
select t.as_(:'ben'); set local role authenticated;
select t.must_fail($$insert into public.ember_memories (body) values ('one too many')$$, 'up to 50');
reset role;
-- He forgets one.
select set_config('t.mem', :'mem', false);
select t.as_(:'ben'); set local role authenticated;
delete from public.ember_memories where id = current_setting('t.mem')::uuid;
reset role;
select t.ok(not exists (select 1 from public.ember_memories where id = :'mem'), 'he forgets his own');

-- Deleting the profile deletes them.
delete from public.profiles where id = :'ben';
select t.ok(not exists (select 1 from public.ember_memories where user_id = :'ben'), 'gone with the account');

\echo 'ember-memory: all passed'
rollback;
