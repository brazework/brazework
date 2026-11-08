-- Projects on profiles, and project posts in the feed. Run after activity.sql.
--
-- A project's card (title, summary, status, topics, private or not) is readable by every member,
-- so private projects still show a summary. The full write-up and link live in project_details,
-- which only the owner can read while the project is private.
--
-- Sharing a project to the feed is an ordinary post with project_id set, so likes, comments,
-- saves and notifications work the same as on any other post. Only the owner can post about
-- their project, and only to the main feed.

-- ---------- Projects ----------

create table public.projects (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 600),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  year smallint check (year between 1950 and 2100),
  tags text[] not null default '{}' check (cardinality(tags) <= 3),
  private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, created_at desc);
create index projects_tags_idx on public.projects using gin (tags);

create table public.project_details (
  project_id text primary key references public.projects (id) on delete cascade,
  details text not null default '' check (char_length(details) <= 5000),
  link text not null default '' check (char_length(link) <= 300 and (link = '' or link ~* '^https?://[^\s]+$'))
);

-- Owners can't be changed, and the times are the database's.
create function public.projects_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.owner_id := auth.uid(); end if;
    new.created_at := now();
  else
    new.owner_id := old.owner_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.projects_before_write();

revoke all on public.projects, public.project_details from anon, authenticated;
alter table public.projects enable row level security;
alter table public.project_details enable row level security;

grant select, delete on public.projects to authenticated;
grant insert (title, summary, status, year, tags, private) on public.projects to authenticated;
grant update (title, summary, status, year, tags, private) on public.projects to authenticated;
create policy "members read project cards" on public.projects for select to authenticated using (true);
create policy "add your projects" on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy "edit your projects" on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete your projects" on public.projects for delete to authenticated using (owner_id = auth.uid());

grant select, delete on public.project_details to authenticated;
grant insert (project_id, details, link) on public.project_details to authenticated;
grant update (details, link) on public.project_details to authenticated;
create policy "read public details or your own" on public.project_details for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and (not p.private or p.owner_id = auth.uid())));
create policy "write your details" on public.project_details for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- ---------- Project posts ----------

alter table public.posts add column project_id text references public.projects (id) on delete cascade;
create index posts_project_idx on public.posts (project_id) where project_id is not null;
grant insert (project_id) on public.posts to authenticated;

-- Posts about a project are always "Project" posts.
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
  if new.project_id is not null then new.kind := 'project'; end if;
  return new;
end $$;

drop policy "write posts" on public.posts;
create policy "write posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid()
    and (community_id is null or public.my_rank(community_id) > 0)
    and (project_id is null or (community_id is null
         and exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()))));

revoke execute on function public.projects_before_write() from anon, authenticated, public;

alter publication supabase_realtime add table public.projects;
