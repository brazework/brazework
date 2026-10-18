-- Forge database (Supabase / Postgres).
-- The database only lets people do what the app allows; hiding a button is never enough.
-- Run once on a new Supabase project: node scripts/apply-schema.mjs (or paste into the SQL editor).
-- Signing in requires a confirmed email, so "authenticated" here always means a verified member.

-- ---------- Members ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  birthday text not null default '',
  account_type text not null check (account_type in ('student', 'professional')),
  headline text not null default '' check (char_length(headline) <= 200),
  bio text not null default '' check (char_length(bio) <= 2000),
  field text not null default '',
  interests text[] not null default '{}' check (cardinality(interests) <= 100),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_interests_idx on public.profiles using gin (interests);
create index profiles_field_idx on public.profiles (field);

-- A profile is made from the details given at sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m ? 'accountType' then
    insert into public.profiles (id, first_name, last_name, birthday, account_type)
    values (new.id, left(coalesce(m->>'firstName', ''), 80), left(coalesce(m->>'lastName', ''), 80),
            coalesce(m->>'birthday', ''),
            case when m->>'accountType' = 'student' then 'student' else 'professional' end)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The few profile fields copied onto connections and follows, so lists load fast.
create function public.person_info(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('firstName', first_name, 'lastName', last_name, 'headline', headline,
                            'field', field, 'accountType', account_type)
  from public.profiles where id = uid
$$;

-- Saved posts are private to their owner (table defined after posts).

-- Organization interest from the landing page: anyone may submit one;
-- nobody can read, change or delete them from the site (view them in the Supabase dashboard).
create table public.org_interest (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('company', 'school')),
  name text not null check (char_length(name) between 1 and 120),
  contact text not null check (char_length(contact) between 1 and 80),
  email text not null check (char_length(email) <= 120 and email ~ '^[^@ ]+@[^@ ]+[.][^@ ]+$'),
  role text not null default '' check (char_length(role) <= 80),
  created_at timestamptz not null default now()
);

-- ---------- Communities ----------
-- Roles, highest first: owner 5, admin 4, moderator 3, helper 2, member 1.
-- Everyone can only act on people below their own role.

create table public.communities (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 3 and 60),
  name_lower text generated always as (lower(name)) stored,
  about text not null default '' check (char_length(about) <= 500),
  field text not null default '',
  type text not null check (type in ('field', 'study', 'project', 'school')),
  privacy text not null check (privacy in ('public', 'approval')),
  topics text[] not null default '{}' check (cardinality(topics) <= 3),
  rules text not null default '' check (char_length(rules) <= 1500),
  owner_id uuid references public.profiles (id) on delete set null,
  owner_name text not null default '',
  member_count integer not null default 0,
  automod jsonb not null default '{"words": [], "holdNewLinks": false}'::jsonb
    check (jsonb_typeof(automod->'words') = 'array' and jsonb_array_length(automod->'words') <= 50),
  created_at timestamptz not null default now()
);
create unique index communities_name_lower_idx on public.communities (name_lower);
create index communities_member_count_idx on public.communities (member_count desc);

create table public.community_members (
  community_id text not null references public.communities (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'helper', 'member')),
  first_name text not null default '',
  last_name text not null default '',
  headline text not null default '',
  joined_at timestamptz not null default now(),
  primary key (community_id, uid)
);
create index community_members_uid_idx on public.community_members (uid);

create table public.community_requests (
  community_id text not null references public.communities (id) on delete cascade,
  uid uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  headline text not null default '',
  at timestamptz not null default now(),
  primary key (community_id, uid)
);

create table public.community_bans (
  community_id text not null references public.communities (id) on delete cascade,
  uid uuid not null references public.profiles (id) on delete cascade,
  name text not null default '',
  banned_by uuid default auth.uid(),
  at timestamptz not null default now(),
  primary key (community_id, uid)
);

create function public.role_rank(r text) returns integer language sql immutable as $$
  select case r when 'owner' then 5 when 'admin' then 4 when 'moderator' then 3
                when 'helper' then 2 when 'member' then 1 else 0 end
$$;

-- Your role's rank in a community (0 if you're not in it).
create function public.my_rank(cid text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select public.role_rank(role) from public.community_members
                   where community_id = cid and uid = auth.uid()), 0)
$$;

create function public.is_banned(cid text, who uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_bans where community_id = cid and uid = who)
$$;

-- Public communities: any member of Forge can read. Approval-required: members only.
create function public.can_view(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities where id = cid and privacy = 'public')
      or public.my_rank(cid) > 0
$$;

-- ---------- Posts (main feed when community_id is empty, otherwise a community's) ----------

create table public.posts (
  id text primary key default gen_random_uuid()::text,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_first text not null default '',
  author_last text not null default '',
  author_headline text not null default '',
  community_id text references public.communities (id) on delete cascade,
  community_name text,
  body text not null check (char_length(body) between 1 and 3000),
  kind text not null default 'update' check (kind in ('update', 'question', 'result', 'project')),
  tags text[] not null default '{}' check (cardinality(tags) <= 3),
  status text not null default 'visible' check (status in ('visible', 'held')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index posts_feed_idx on public.posts (created_at desc) where community_id is null;
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_community_idx on public.posts (community_id, status, created_at desc);

create table public.likes (
  post_id text not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_first text not null default '',
  author_last text not null default '',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.saved (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id text not null references public.posts (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ---------- Network ----------

-- Connections are two-way and start as a request; there can only ever be one between two people.
create table public.connections (
  id text primary key default gen_random_uuid()::text,
  from_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  users uuid[] generated always as (array[from_id, to_id]) stored,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  note text not null default '' check (char_length(note) <= 300),
  people jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (from_id <> to_id)
);
create unique index connections_pair_idx on public.connections (least(from_id, to_id), greatest(from_id, to_id));
create index connections_to_idx on public.connections (to_id, status);
create index connections_from_idx on public.connections (from_id, status);
create index connections_users_idx on public.connections using gin (users);

-- Follows are one-way.
create table public.follows (
  follower uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  follower_info jsonb not null default '{}'::jsonb,
  target_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (follower, target),
  check (follower <> target)
);
create index follows_target_idx on public.follows (target);

-- ---------- Triggers: names, counts and the things members can't set themselves ----------

-- New posts: author details come from the author's profile, counts start at zero.
create function public.posts_before_insert() returns trigger
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
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

-- The author can edit their own post; only moderators can publish a held post.
create function public.posts_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.body, new.kind, new.tags) is distinct from (old.body, old.kind, old.tags)
     and old.author_id <> auth.uid() then
    raise exception 'Only the author can edit a post.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not (old.community_id is not null and new.status = 'visible' and public.my_rank(old.community_id) >= 3) then
    raise exception 'Only moderators can review posts.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger posts_before_update before update on public.posts
  for each row execute function public.posts_before_update();

-- Likes and comments move their post's counts by one, together.
create function public.likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger likes_count after insert or delete on public.likes
  for each row execute function public.likes_count();

create function public.comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is not null then new.author_id := auth.uid(); new.created_at := now(); end if;
  select * into p from public.profiles where id = new.author_id;
  new.author_first := coalesce(p.first_name, ''); new.author_last := coalesce(p.last_name, '');
  return new;
end $$;
create trigger comments_before_insert before insert on public.comments
  for each row execute function public.comments_before_insert();

create function public.comments_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.comments_count();

-- Member, request and ban rows carry the person's name.
create function public.fill_person() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.uid;
  if tg_table_name = 'community_bans' then
    new.name := trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''));
    if auth.uid() is not null then new.banned_by := auth.uid(); new.at := now(); end if;
  else
    new.first_name := coalesce(p.first_name, ''); new.last_name := coalesce(p.last_name, '');
    new.headline := coalesce(p.headline, '');
    if auth.uid() is not null then
      if tg_table_name = 'community_members' then new.joined_at := now(); else new.at := now(); end if;
    end if;
  end if;
  return new;
end $$;
create trigger members_fill before insert on public.community_members
  for each row execute function public.fill_person();
create trigger requests_fill before insert on public.community_requests
  for each row execute function public.fill_person();
create trigger bans_fill before insert on public.community_bans
  for each row execute function public.fill_person();

-- The member count moves by one, only together with someone actually joining or leaving.
create function public.members_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  else
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;
create trigger members_count after insert or delete on public.community_members
  for each row execute function public.members_count();

create function public.connections_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.from_id := auth.uid(); new.status := 'pending'; new.created_at := now(); new.accepted_at := null;
    end if;
    new.people := jsonb_build_object(new.from_id::text, coalesce(public.person_info(new.from_id), '{}'::jsonb),
                                     new.to_id::text, coalesce(public.person_info(new.to_id), '{}'::jsonb));
  elsif new.status = 'accepted' and old.status = 'pending' and auth.uid() is not null then
    new.accepted_at := now();
  end if;
  return new;
end $$;
create trigger connections_before before insert or update on public.connections
  for each row execute function public.connections_before();

create function public.follows_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.follower := auth.uid(); new.created_at := now(); end if;
  new.follower_info := coalesce(public.person_info(new.follower), '{}'::jsonb);
  new.target_info := coalesce(public.person_info(new.target), '{}'::jsonb);
  return new;
end $$;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

create function public.org_interest_before_insert() returns trigger language plpgsql as $$
begin new.created_at := now(); return new; end $$;
create trigger org_interest_before_insert before insert on public.org_interest
  for each row execute function public.org_interest_before_insert();

-- ---------- Actions that change several rows at once ----------

-- Creates a community with you as its owner.
create function public.create_community(p_name text, p_about text, p_field text, p_type text,
                                        p_privacy text, p_topics text[], p_rules text)
returns text language plpgsql security definer set search_path = public as $$
declare cid text; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name)
  values (p_name, coalesce(p_about, ''), coalesce(p_field, ''), p_type, p_privacy, coalesce(p_topics, '{}'),
          coalesce(p_rules, ''), me.id, trim(me.first_name || ' ' || me.last_name))
  returning id into cid;
  insert into public.community_members (community_id, uid, role) values (cid, me.id, 'owner');
  return cid;
end $$;

-- Helpers and above approve someone's pending request.
create function public.approve_request(p_cid text, p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_rank(p_cid) < 2 then raise exception 'You don''t have permission to do that.' using errcode = '42501'; end if;
  if not exists (select 1 from public.community_requests where community_id = p_cid and uid = p_uid) then
    raise exception 'That request was withdrawn.' using errcode = 'P0002';
  end if;
  if public.is_banned(p_cid, p_uid) then raise exception 'That person is banned from this community.' using errcode = '42501'; end if;
  insert into public.community_members (community_id, uid, role) values (p_cid, p_uid, 'member') on conflict do nothing;
  delete from public.community_requests where community_id = p_cid and uid = p_uid;
end $$;

-- ---------- Who can do what ----------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, public;
grant execute on function public.create_community(text, text, text, text, text, text[], text),
                          public.approve_request(text, uuid), public.my_rank(text), public.can_view(text),
                          public.is_banned(text, uuid), public.role_rank(text)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.org_interest enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_requests enable row level security;
alter table public.community_bans enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved enable row level security;
alter table public.connections enable row level security;
alter table public.follows enable row level security;

-- Profiles: members can read (birthdays stay private); you can only change your own,
-- and never your account type or birthday.
grant select (id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at)
  on public.profiles to authenticated;
grant update (first_name, last_name, headline, bio, field, interests, onboarded) on public.profiles to authenticated;
create policy "members read profiles" on public.profiles for select to authenticated using (true);
create policy "edit your own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant insert (type, name, contact, email, role) on public.org_interest to anon, authenticated;
create policy "anyone can register interest" on public.org_interest for insert to anon, authenticated with check (true);

-- Communities: admins and the owner edit the info and auto-moderation.
grant select on public.communities to authenticated;
grant update (name, about, rules, field, type, privacy, topics, automod) on public.communities to authenticated;
create policy "members read communities" on public.communities for select to authenticated using (true);
create policy "admins edit communities" on public.communities for update to authenticated
  using (public.my_rank(id) >= 4) with check (public.my_rank(id) >= 4);

-- Community members: join a public community yourself unless banned; admins change roles below their own;
-- leave yourself (the owner can't), or moderators and above remove people below them.
grant select on public.community_members to authenticated;
grant insert (community_id, uid, role) on public.community_members to authenticated;
grant update (role) on public.community_members to authenticated;
grant delete on public.community_members to authenticated;
create policy "read members" on public.community_members for select to authenticated using (true);
create policy "join public communities" on public.community_members for insert to authenticated
  with check (uid = auth.uid() and role = 'member'
    and exists (select 1 from public.communities c where c.id = community_id and c.privacy = 'public')
    and not public.is_banned(community_id, auth.uid()));
create policy "admins change roles below theirs" on public.community_members for update to authenticated
  using (public.my_rank(community_id) >= 4 and public.role_rank(role) < public.my_rank(community_id))
  with check (public.role_rank(role) >= 1 and public.role_rank(role) < public.my_rank(community_id));
create policy "leave or remove" on public.community_members for delete to authenticated
  using ((uid = auth.uid() and role <> 'owner')
    or (public.my_rank(community_id) >= 3 and public.role_rank(role) < public.my_rank(community_id)));

-- Join requests (approval-required communities): visible to the requester and helpers and above.
grant select, delete on public.community_requests to authenticated;
grant insert (community_id) on public.community_requests to authenticated;
create policy "read requests" on public.community_requests for select to authenticated
  using (uid = auth.uid() or public.my_rank(community_id) >= 2);
create policy "ask to join" on public.community_requests for insert to authenticated
  with check (uid = auth.uid()
    and exists (select 1 from public.communities c where c.id = community_id and c.privacy = 'approval')
    and public.my_rank(community_id) = 0
    and not public.is_banned(community_id, auth.uid()));
create policy "withdraw or decline requests" on public.community_requests for delete to authenticated
  using (uid = auth.uid() or public.my_rank(community_id) >= 2);

-- Bans: moderators and above, only for people below them.
grant select, delete on public.community_bans to authenticated;
grant insert (community_id, uid) on public.community_bans to authenticated;
create policy "moderators read bans" on public.community_bans for select to authenticated
  using (public.my_rank(community_id) >= 3);
create policy "moderators ban people below them" on public.community_bans for insert to authenticated
  with check (public.my_rank(community_id) >= 3
    and exists (select 1 from public.community_members m where m.community_id = community_bans.community_id
                and m.uid = community_bans.uid and public.role_rank(m.role) < public.my_rank(community_bans.community_id)));
create policy "moderators lift bans" on public.community_bans for delete to authenticated
  using (public.my_rank(community_id) >= 3);

-- Posts. Main feed: every member reads. Communities: public ones anyone, approval-required ones members only.
-- Held posts: the author and moderators.
grant select, delete on public.posts to authenticated;
grant insert (body, kind, tags, community_id, status) on public.posts to authenticated;
grant update (body, kind, tags, status) on public.posts to authenticated;
create policy "read posts" on public.posts for select to authenticated
  using ((status = 'visible' and (community_id is null or public.can_view(community_id)))
    or author_id = auth.uid()
    or (community_id is not null and public.my_rank(community_id) >= 3));
create policy "write posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (community_id is null or public.my_rank(community_id) > 0));
create policy "edit or review posts" on public.posts for update to authenticated
  using (author_id = auth.uid() or (community_id is not null and public.my_rank(community_id) >= 3));
create policy "delete posts" on public.posts for delete to authenticated
  using (author_id = auth.uid() or (community_id is not null and public.my_rank(community_id) >= 3));

-- One like per member per post.
grant select, delete on public.likes to authenticated;
grant insert (post_id) on public.likes to authenticated;
create policy "read likes" on public.likes for select to authenticated using (true);
create policy "like posts you can see" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy "unlike" on public.likes for delete to authenticated using (user_id = auth.uid());

-- Comments: anyone who can see the post reads them; community posts need membership to comment.
-- The commenter, the post's author or a community moderator can remove one.
grant select, delete on public.comments to authenticated;
grant insert (post_id, body) on public.comments to authenticated;
create policy "read comments" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "write comments" on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id
    and (p.community_id is null or public.my_rank(p.community_id) > 0)));
create policy "delete comments" on public.comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id
    and (p.author_id = auth.uid() or (p.community_id is not null and public.my_rank(p.community_id) >= 3))));

-- Saved posts are private to their owner.
grant select, delete on public.saved to authenticated;
grant insert (post_id) on public.saved to authenticated;
create policy "your saved posts" on public.saved for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Connections: accepted ones are visible to members; pending requests only to the two people involved.
-- Only the person who received a request can accept it; either person can decline, withdraw or remove.
grant select, delete on public.connections to authenticated;
grant insert (to_id, note) on public.connections to authenticated;
grant update (status) on public.connections to authenticated;
create policy "read connections" on public.connections for select to authenticated
  using (status = 'accepted' or from_id = auth.uid() or to_id = auth.uid());
create policy "send requests" on public.connections for insert to authenticated
  with check (from_id = auth.uid() and to_id <> auth.uid() and status = 'pending');
create policy "accept requests" on public.connections for update to authenticated
  using (to_id = auth.uid() and status = 'pending') with check (status = 'accepted');
create policy "remove connections" on public.connections for delete to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

-- Follows.
grant select, delete on public.follows to authenticated;
grant insert (target) on public.follows to authenticated;
create policy "read follows" on public.follows for select to authenticated using (true);
create policy "follow people" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "unfollow" on public.follows for delete to authenticated using (follower = auth.uid());

-- ---------- Live updates ----------

alter publication supabase_realtime add table public.posts, public.comments, public.saved,
  public.community_requests, public.communities;
