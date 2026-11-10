-- Possible duplicate clubs: a new club whose name closely matches an existing one ("NSBE UHart" and
-- "NSBE at UHart") goes to the Forge admin queue, so one chapter doesn't split its members and its
-- verified history. The club is still created; this only flags it. Uses pg_trgm (feedback.sql).
-- Run after school-requests.sql. Additive.

insert into public.app_config (key, value) values ('duplicate_club_similarity', '55') on conflict (key) do nothing;

-- Names compared without case, punctuation or filler words.
create function public.club_name_key(n text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(n, '')), '[^a-z0-9 ]+', ' ', 'g'),
    '\m(the|of|at|club|chapter|society|team|association|university|college)\M', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create function public.flag_duplicate_club() returns trigger
language plpgsql security definer set search_path = public as $$
declare twin record;
begin
  select c.id, c.name, extensions.similarity(public.club_name_key(c.name), public.club_name_key(new.name)) as score into twin
  from public.communities c
  where c.id <> new.id and extensions.similarity(public.club_name_key(c.name), public.club_name_key(new.name)) * 100 >= public.config_int('duplicate_club_similarity', 55)
  order by 3 desc limit 1;
  if twin.id is not null then
    insert into public.admin_queue (kind, subject_id, community_id, detail)
    values ('duplicate_club', new.id, new.id, left(format('"%s" looks like the existing "%s" (/c/%s). Merge or confirm they''re different.', new.name, twin.name, twin.id), 500));
  end if;
  return null;
end $$;
create trigger flag_duplicate_club after insert on public.communities for each row execute function public.flag_duplicate_club();
revoke execute on function public.flag_duplicate_club() from anon, authenticated, public;
