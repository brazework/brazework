-- Reporting and blocking from anywhere: a post, a reply, a person or a message. Run after
-- chat-extras.sql. Additive.
--
-- Reports: any member can report something they can see, once per thing, with a reason. Only the
-- reporter can see their own reports; reviewing them is for the team (service role). The person
-- being reported is filled in by the database from the target, never by the app.
-- Blocking: block_user stops someone messaging you (message_blocks) and removes follows both ways;
-- the apps also hide their posts from your feed.

create table public.content_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'comment', 'person', 'message', 'chat_message')),
  target_id text not null check (char_length(target_id) between 1 and 64),
  reported uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'other')),
  detail text not null default '' check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter, kind, target_id)
);
create index content_reports_open_idx on public.content_reports (created_at desc) where status = 'open';

create function public.content_reports_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reporter := auth.uid();
  new.status := 'open';
  new.detail := btrim(new.detail);
  new.reported := case new.kind
    when 'post' then (select author_id from public.posts where id = new.target_id)
    when 'comment' then (select author_id from public.comments where id = new.target_id)
    when 'person' then (select id from public.profiles where new.target_id ~ '^[0-9a-f-]{36}$' and id = new.target_id::uuid)
    when 'message' then (select sender_id from public.messages where id = new.target_id)
    when 'chat_message' then (select sender_id from public.chat_messages where id = new.target_id)
  end;
  if new.reported is null then raise exception 'That''s no longer there.' using errcode = 'P0001'; end if;
  if new.reported = auth.uid() then raise exception 'You can''t report yourself.' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger content_reports_before_insert before insert on public.content_reports
  for each row execute function public.content_reports_before_insert();

alter table public.content_reports enable row level security;
create policy "file a report" on public.content_reports for insert to authenticated with check (reporter = auth.uid());
create policy "your reports" on public.content_reports for select to authenticated using (reporter = auth.uid());
revoke all on public.content_reports from anon, authenticated;
grant select (id, kind, target_id, reason, status, created_at) on public.content_reports to authenticated;
grant insert (kind, target_id, reason, detail) on public.content_reports to authenticated;

-- Block someone from anywhere (their profile, a post, a chat).
create function public.block_user(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if p_uid = auth.uid() then raise exception 'You can''t block yourself.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_uid) then raise exception 'That person isn''t on Forge.' using errcode = 'P0001'; end if;
  insert into public.message_blocks (blocker, blocked) values (auth.uid(), p_uid) on conflict do nothing;
  delete from public.follows where (follower = auth.uid() and target = p_uid) or (follower = p_uid and target = auth.uid());
end $$;

revoke execute on function public.content_reports_before_insert() from anon, authenticated, public;
revoke execute on function public.block_user(uuid) from anon, public;
grant execute on function public.block_user(uuid) to authenticated;
