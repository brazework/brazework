-- Reports, part two: projects, milestones and challenges can be reported too (a faked project or a
-- milestone claimed with someone else's evidence is what would hurt verified work most), and Forge
-- admins see and resolve every report. Run after rate-limits.sql. Additive.

alter table public.content_reports drop constraint content_reports_kind_check;
alter table public.content_reports add constraint content_reports_kind_check
  check (kind in ('post', 'comment', 'person', 'message', 'chat_message', 'project', 'milestone', 'challenge'));
alter table public.content_reports add column resolved_by uuid references public.profiles (id) on delete set null;
alter table public.content_reports add column resolved_at timestamptz;

create or replace function public.content_reports_before_insert() returns trigger
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
    when 'project' then (select owner_id from public.projects where id = new.target_id)
    when 'milestone' then (select owner_id from public.milestones where id = new.target_id)
    when 'challenge' then (select created_by from public.challenges where id = new.target_id)
  end;
  if new.reported is null then raise exception 'That''s no longer there.' using errcode = 'P0001'; end if;
  if new.reported = auth.uid() then raise exception 'You can''t report yourself.' using errcode = 'P0001'; end if;
  return new;
end $$;

-- Forge admins read every report (with its detail) and resolve it.
create policy "admins read reports" on public.content_reports for select to authenticated using (public.is_forge_admin());
grant select (detail, reported, reporter, resolved_at) on public.content_reports to authenticated;

create function public.resolve_report(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forge_admin() then raise exception 'Forge admins only.' using errcode = '42501'; end if;
  if p_status not in ('reviewed', 'actioned', 'dismissed') then raise exception 'Unknown status.' using errcode = 'P0001'; end if;
  update public.content_reports set status = p_status, resolved_by = auth.uid(), resolved_at = now() where id = p_id;
  if not found then raise exception 'No such report.' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.resolve_report(bigint, text) from anon, public;
grant execute on function public.resolve_report(bigint, text) to authenticated;

-- Admin metrics count open reports alongside the review queue.
create or replace function public.open_reports() returns bigint
language sql stable security definer set search_path = public as $$
  select case when public.is_forge_admin() then (select count(*) from public.content_reports where status = 'open') else 0 end
$$;
revoke execute on function public.open_reports() from anon, public;
grant execute on function public.open_reports() to authenticated;
