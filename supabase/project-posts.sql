-- Projects at the center: an update about a project can also go to one of your clubs, so the club
-- sees the work it may later verify; and a project post keeps the kind you chose (update, result,
-- question) instead of always becoming a "project" post. Run after reports.sql. Additive.

-- Same as projects.sql's version, minus forcing kind to 'project' (sharing a project still sends
-- kind 'project' itself).
create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is not null then new.author_id := auth.uid(); end if;
  select * into p from public.profiles where id = new.author_id;
  new.author_first := coalesce(p.first_name, ''); new.author_last := coalesce(p.last_name, '');
  new.author_headline := coalesce(p.headline, '');
  if auth.uid() is not null then
    new.like_count := 0; new.comment_count := 0; new.created_at := now();
  end if;
  if new.community_id is null then
    new.status := 'visible'; new.community_name := null;
  else
    select name into new.community_name from public.communities where id = new.community_id;
  end if;
  return new;
end $$;

-- A project post: your own project; optionally to a club you're in.
drop policy "write posts" on public.posts;
create policy "write posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid()
    and (community_id is null or public.my_rank(community_id) > 0)
    and (project_id is null or exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid())));

-- Lets the app know this file has run (db-features.ts).
create function public.project_posts_ready() returns boolean language sql immutable as $$ select true $$;
grant execute on function public.project_posts_ready() to authenticated;
