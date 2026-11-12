-- Live GitHub progress in a project's build log (Linear FIX-92, phase 3). A member installs
-- Brazework's GitHub App (infra/github-app.json, read-only) and links a repo to a project; GitHub's
-- signed webhooks then add merged pull requests, releases, CI results, deploys and pushes to the
-- default branch to that project's build log. Run after who-looked.sql. Additive; safe to run again.
--
-- Who writes: only the server, with the service key, after it has checked GitHub's signature (the
-- webhook) or that the member signed in with GitHub and owns the project (linking). Members read a
-- project's repos and events when the project is public, or it's theirs, or they're on its team:
-- spelled out here (can_see_project), because the projects table itself lets members read every
-- row, private ones included, and leaves hiding them to the page.

create or replace function public.can_see_project(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project
       and (not p.private or p.owner_id = auth.uid()
            or exists (select 1 from public.project_members m where m.project_id = p.id and m.uid = auth.uid()))
  )
$$;
revoke execute on function public.can_see_project(text) from public, anon;
grant execute on function public.can_see_project(text) to authenticated;

-- ---------- Installations: the GitHub accounts or orgs a member installed the App on ----------
create table if not exists public.github_installations (
  installation_id bigint primary key,
  account_login text not null check (char_length(account_login) between 1 and 100),
  account_type text not null default 'User' check (account_type in ('User', 'Organization')),
  installed_by uuid references auth.users(id) on delete set null,
  github_user_id bigint,
  created_at timestamptz not null default now(),
  suspended_at timestamptz
);
alter table public.github_installations enable row level security;
revoke all on public.github_installations from anon, authenticated;
grant select on public.github_installations to authenticated;
drop policy if exists "Your own installations" on public.github_installations;
create policy "Your own installations" on public.github_installations for select to authenticated using (installed_by = auth.uid());
create index if not exists github_installations_installed_by_idx on public.github_installations (installed_by);

-- ---------- Which repo feeds which project ----------
create table if not exists public.project_repos (
  project_id text not null references public.projects(id) on delete cascade,
  installation_id bigint not null references public.github_installations(installation_id) on delete cascade,
  repo_id bigint not null,
  full_name text not null check (full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  html_url text not null check (html_url ~ '^https://github\.com/'),
  default_branch text not null default 'main' check (char_length(default_branch) between 1 and 255),
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key (project_id, repo_id)
);
alter table public.project_repos enable row level security;
revoke all on public.project_repos from anon, authenticated;
grant select on public.project_repos to authenticated;
drop policy if exists "Repos of projects you can see" on public.project_repos;
create policy "Repos of projects you can see" on public.project_repos for select to authenticated
  using (public.can_see_project(project_id));
create index if not exists project_repos_repo_idx on public.project_repos (repo_id);
create index if not exists project_repos_installation_idx on public.project_repos (installation_id);

-- ---------- What happened, as build-log entries ----------
create table if not exists public.build_events (
  id bigint generated always as identity primary key,
  project_id text not null references public.projects(id) on delete cascade,
  repo_id bigint not null,
  kind text not null check (kind in ('pr_merged', 'release', 'ci', 'deploy', 'push')),
  title text not null check (char_length(title) between 1 and 300),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  actor text not null default '' check (char_length(actor) <= 100),
  ref text not null default '' check (char_length(ref) <= 255),
  state text not null default '' check (char_length(state) <= 50),
  occurred_at timestamptz not null,
  -- One entry per thing on GitHub: "pr:42", "release:123456", "ci:<sha>", "deploy:<id>", "push:<sha>".
  -- A retried delivery, or the same repo backfilled twice, can't add it again.
  source_id text not null check (char_length(source_id) between 1 and 120),
  unique (project_id, repo_id, source_id)
);
alter table public.build_events enable row level security;
revoke all on public.build_events from anon, authenticated;
grant select on public.build_events to authenticated;
drop policy if exists "Events of projects you can see" on public.build_events;
create policy "Events of projects you can see" on public.build_events for select to authenticated
  using (public.can_see_project(project_id));
create index if not exists build_events_project_time_idx on public.build_events (project_id, occurred_at desc);

-- ---------- Webhook deliveries already handled (GitHub retries; X-GitHub-Delivery is unique) ----------
create table if not exists public.github_deliveries (
  delivery_id text primary key check (char_length(delivery_id) between 1 and 100),
  event text not null default '',
  received_at timestamptz not null default now()
);
alter table public.github_deliveries enable row level security;
revoke all on public.github_deliveries from anon, authenticated;
create index if not exists github_deliveries_received_idx on public.github_deliveries (received_at);

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.github_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.github_ready() to authenticated;
