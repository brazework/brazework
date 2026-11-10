-- Shareable club reports: a club's owner or admins make a private link that shows what the club did
-- this semester (events and attendance, public club-verified work, challenge wins) to people who
-- aren't on Forge, like a sponsor. Only public information is in it; the link can be revoked, which
-- stops it working at once. Run after club-duplicates.sql. Additive.

create table public.club_report_links (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  community_id text not null references public.communities (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  period_days int not null default 120 check (period_days between 7 and 365),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index club_report_links_live on public.club_report_links (community_id) where revoked_at is null;
alter table public.club_report_links enable row level security;
revoke all on public.club_report_links from anon, authenticated;
grant select (token, community_id, period_days, created_at, revoked_at) on public.club_report_links to authenticated;
create policy "officers see their club's report links" on public.club_report_links for select to authenticated
  using (public.my_rank(community_id) >= 4);

-- The club's live link (made if there isn't one). Owners and admins only.
create function public.club_report_link(p_cid text) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if public.my_rank(p_cid) < 4 then raise exception 'Only the club''s owner and admins can share its report.' using errcode = '42501'; end if;
  select token into t from public.club_report_links where community_id = p_cid and revoked_at is null;
  if t is null then
    insert into public.club_report_links (community_id, created_by) values (p_cid, auth.uid()) returning token into t;
  end if;
  return t;
end $$;

create function public.revoke_club_report_link(p_cid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_rank(p_cid) < 4 then raise exception 'Only the club''s owner and admins can do that.' using errcode = '42501'; end if;
  update public.club_report_links set revoked_at = now() where community_id = p_cid and revoked_at is null;
end $$;

-- The report itself, for anyone holding a live link. Public information only.
create function public.public_club_report(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.club_report_links; since timestamptz; r jsonb;
begin
  select * into l from public.club_report_links where token = p_token and revoked_at is null;
  if l.token is null then return null; end if;
  since := now() - make_interval(days => l.period_days);
  select jsonb_build_object(
    'club', (select jsonb_build_object('id', c.id, 'name', c.name, 'about', c.about, 'field', c.field, 'members', c.member_count) from public.communities c where c.id = l.community_id),
    'since', since,
    'events', coalesce((select jsonb_agg(jsonb_build_object('title', e.title, 'type', e.type, 'starts_at', e.starts_at, 'going', e.rsvp_count) order by e.starts_at desc)
      from public.events e where e.community_id = l.community_id and e.status = 'published' and e.starts_at between since and now()), '[]'),
    'verified', coalesce((select jsonb_agg(v order by v->>'at' desc) from (
      select jsonb_build_object('title', m.title, 'member', btrim(p.first_name || ' ' || p.last_name), 'project', pr.title,
                                'verified_by', m.reviewer_name, 'at', m.reviewed_at) as v
      from public.milestones m join public.profiles p on p.id = m.owner_id left join public.projects pr on pr.id = m.project_id and not pr.private
      where m.community_id = l.community_id and m.status = 'verified' and not m.private and m.reviewed_at >= since
      order by m.reviewed_at desc limit 40) x), '[]'),
    'builders', (select count(distinct m.owner_id) from public.milestones m where m.community_id = l.community_id and m.status = 'verified' and not m.private and m.reviewed_at >= since),
    'posts', (select count(*) from public.posts po where po.community_id = l.community_id and po.status = 'visible' and po.created_at >= since),
    'wins', coalesce((select jsonb_agg(jsonb_build_object('member', btrim(p.first_name || ' ' || p.last_name), 'place', ce.placement, 'challenge', ch.title, 'sponsor', o.name))
      from public.challenge_entries ce join public.challenges ch on ch.id = ce.challenge_id and ch.status = 'closed'
      join public.organizations o on o.id = ch.org_id join public.profiles p on p.id = ce.uid
      where ce.placement is not null and ch.created_at >= since
        and exists (select 1 from public.community_members cm where cm.community_id = l.community_id and cm.uid = ce.uid)), '[]')
  ) into r;
  return r;
end $$;

revoke execute on function public.club_report_link(text), public.revoke_club_report_link(text), public.public_club_report(text) from public;
grant execute on function public.club_report_link(text), public.revoke_club_report_link(text) to authenticated;
grant execute on function public.public_club_report(text) to anon, authenticated;
