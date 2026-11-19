-- Step 80: messages say Brazework, not Forge. Run after tool-signer.sql. Additive and safe to re-run.
--
-- The app was renamed, but the database still raised errors that named Forge: the posting pace
-- ("You're posting faster than Forge allows"), claiming a club, feedback, blocking someone, disputes,
-- and "Forge admins only." on the admin tools. Each function below is redefined whole, copied from the
-- one step that defines it (named above it), with only the word in its messages changed. Nothing else
-- in them changes, and create or replace keeps their grants. One catch: create or replace drops
-- settings a later step added with alter function, so slow_down() states the search_path that
-- hardening.sql gave it.
--
-- Also renames the organization that hosts the team's own events (events.sql) from Forge to
-- Brazework, since members see its name on those events. Left as they are: policy names and
-- is_forge_admin(), which nobody sees, and the founders' feedback log (feedback.sql feedback_sync),
-- whose document title the sync looks up.

-- submit_feedback(): from feedback.sql
create or replace function public.submit_feedback(p_kind text, p_area text, p_body text, p_may_contact boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[ \t]+', ' ', 'g'));
  n text := public.feedback_normalize(coalesce(p_body, ''));
  cfg public.feedback_settings;
  best uuid; best_score real; th public.feedback_themes; fid bigint; joined boolean := false; others int := 0;
begin
  if me is null then raise exception 'Log in to send feedback.' using errcode = '42501'; end if;
  if p_kind not in ('idea', 'problem', 'improvement', 'praise') then raise exception 'Choose what kind of feedback this is.' using errcode = '22023'; end if;
  if p_area not in ('general', 'feed', 'search', 'profiles', 'communities', 'messages', 'events', 'network', 'notifications', 'other') then raise exception 'Choose which part of Brazework this is about.' using errcode = '22023'; end if;
  if char_length(v_body) < 10 then raise exception 'Tell us a little more (at least 10 characters).' using errcode = '22023'; end if;
  if char_length(v_body) > 1000 then raise exception 'Keep it under 1,000 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.feedback where user_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Thanks for all the feedback today! You can send more tomorrow.' using errcode = 'P0001';
  end if;
  select * into cfg from public.feedback_settings;

  -- The closest existing idea: the most similar single piece of feedback in it. Same area (similar
  -- letters, or at least half their meaningful words shared), or very close wording in any area.
  -- Praise only groups with praise.
  if n <> '' then
    select f.theme_id,
           max(greatest(extensions.similarity(f.norm, n),
                        case when t.area = p_area and public.feedback_overlap(f.norm, n) >= 0.5 then public.feedback_overlap(f.norm, n) else 0 end))
      into best, best_score
    from public.feedback f join public.feedback_themes t on t.id = f.theme_id
    where f.norm <> '' and ((p_kind = 'praise') = (t.kind = 'praise'))
      and (t.area = p_area or extensions.similarity(f.norm, n) >= 0.55)
    group by f.theme_id
    order by 2 desc
    limit 1;
  end if;

  if best is not null and best_score >= cfg.group_threshold then
    joined := true;
    select * into th from public.feedback_themes where id = best;
  else
    insert into public.feedback_themes (name, kind, area, linear_state)
    values (public.feedback_name(v_body, p_area), p_kind, p_area, case when p_kind = 'praise' then 'skipped' else 'pending' end)
    returning * into th;
  end if;

  select count(distinct user_id) into others from public.feedback where theme_id = th.id and user_id <> me;
  insert into public.feedback (user_id, kind, area, body, norm, may_contact, theme_id)
  values (me, p_kind, p_area, v_body, n, coalesce(p_may_contact, false), th.id) returning id into fid;

  update public.feedback_themes t set
    submissions = t.submissions + 1,
    members = (select count(distinct user_id) from public.feedback where theme_id = t.id),
    last_at = now(),
    -- A problem report makes the idea a problem; otherwise keep what it started as.
    kind = case when p_kind = 'problem' and t.kind <> 'praise' then 'problem' else t.kind end,
    needs_sync = true
  where t.id = th.id;
  update public.feedback_settings set log_needs_sync = true where id;

  perform public.feedback_sync();
  return jsonb_build_object('id', fid, 'idea', th.name, 'joined', joined, 'others', others);
end $$;

-- block_user(): from reports.sql
create or replace function public.block_user(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if p_uid = auth.uid() then raise exception 'You can''t block yourself.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_uid) then raise exception 'That person isn''t on Brazework.' using errcode = 'P0001'; end if;
  insert into public.message_blocks (blocker, blocked) values (auth.uid(), p_uid) on conflict do nothing;
  delete from public.follows where (follower = auth.uid() and target = p_uid) or (follower = p_uid and target = auth.uid());
end $$;

-- resolve_dispute(): from verification.sql
create or replace function public.resolve_dispute(p_id text, p_uphold boolean, p_note text default '') returns text
language plpgsql security definer set search_path = public as $$
declare m public.milestones;
begin
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.status <> 'disputed' or m.escalated then raise exception 'There''s no open dispute for the club to decide.' using errcode = 'P0001'; end if;
  if public.my_rank(m.community_id) < 5 then raise exception 'Only the club''s owner decides disputes.' using errcode = '42501'; end if;
  if public.on_project_team(m.project_id, auth.uid()) then raise exception 'You''re on this project; a Brazework admin will decide.' using errcode = '42501'; end if;
  if p_uphold then
    update public.milestones set status = 'verified', revoked_reason = '', reviewed_at = now() where id = p_id;
    perform public.log_verification(p_id, m.community_id, 'dispute_upheld', p_note);
    perform public.notify(m.owner_id, auth.uid(), 'milestone_verified', null, null, m.community_id, m.title);
    return 'verified';
  end if;
  update public.milestones set escalated = true where id = p_id;
  perform public.log_verification(p_id, m.community_id, 'dispute_rejected', p_note);
  perform public.log_verification(p_id, m.community_id, 'escalated', '');
  insert into public.admin_queue (kind, subject_id, community_id, detail) values ('dispute', p_id, m.community_id, left(m.dispute_note, 500));
  return 'escalated';
end $$;

-- admin_resolve_dispute(): from verification.sql
create or replace function public.admin_resolve_dispute(p_id text, p_uphold boolean, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare m public.milestones;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.status <> 'disputed' or not m.escalated then raise exception 'No escalated dispute here.' using errcode = 'P0001'; end if;
  update public.milestones set status = case when p_uphold then 'verified' else 'refused' end, escalated = false where id = p_id;
  perform public.log_verification(p_id, m.community_id, case when p_uphold then 'admin_upheld' else 'admin_rejected' end, p_note);
  update public.admin_queue set status = 'resolved', resolution = left(coalesce(p_note, ''), 500), resolved_at = now()
   where kind = 'dispute' and subject_id = p_id and status = 'open';
  return case when p_uphold then 'verified' else 'refused' end;
end $$;

-- set_sponsorship(): from challenges.sql
create or replace function public.set_sponsorship(p_id text, p_status text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forge_admin() then
    raise exception 'Brazework admins only.' using errcode = '42501';
  end if;
  if p_status not in ('paid', 'pilot', 'unpaid') then raise exception 'Unknown sponsorship status.' using errcode = 'P0001'; end if;
  update public.challenges set sponsorship = p_status where id = p_id;
  if not found then raise exception 'No such challenge.' using errcode = 'P0001'; end if;
  update public.billing_requests set status = case when p_status = 'unpaid' then 'cancelled' else 'paid' end
    where challenge_id = p_id and status in ('requested', 'checkout');
  return p_status;
end $$;

-- admin_metrics(): from admin-metrics.sql
create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  with active as (
    select author_id as uid from public.posts where created_at > now() - interval '7 days'
    union select author_id from public.comments where created_at > now() - interval '7 days'
    union select sender_id from public.messages where created_at > now() - interval '7 days'
    union select owner_id from public.milestones where created_at > now() - interval '7 days'
  ),
  -- Time from the latest submission to verification, for milestones verified in the last 30 days.
  verify_times as (
    select v.created_at - (select max(s.created_at) from public.verification_events s
                           where s.milestone_id = v.milestone_id and s.action = 'submitted' and s.created_at <= v.created_at) as took
    from public.verification_events v
    where v.action = 'verified' and v.created_at > now() - interval '30 days'
  ),
  club_posts as (
    select c.id, c.name, count(p.id) as posts,
      (select count(*) from public.community_members m where m.community_id = c.id) as members
    from public.communities c
    left join public.posts p on p.community_id = c.id and p.created_at > now() - interval '7 days'
    group by c.id, c.name
  )
  select jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarded),
    'weekly_active', (select count(distinct uid) from active where uid is not null),
    'in_a_club', (select count(distinct uid) from public.community_members),
    'with_project', (select count(distinct owner_id) from public.projects),
    'with_verified', (select count(distinct owner_id) from public.milestones where status = 'verified'),
    'submitted_30d', (select count(*) from public.verification_events where action = 'submitted' and created_at > now() - interval '30 days'),
    'verified_30d', (select count(*) from public.verification_events where action = 'verified' and created_at > now() - interval '30 days'),
    'median_hours_to_verify', (select round((extract(epoch from percentile_cont(0.5) within group (order by took)) / 3600)::numeric, 1) from verify_times where took is not null),
    'clubs', (select count(*) from public.communities),
    'clubs_active_7d', (select count(*) from club_posts where posts > 0),
    'handoffs', (select count(*) from public.club_handoffs),
    'top_clubs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'posts', posts, 'members', members) order by posts desc, members desc), '[]') from (select * from club_posts order by posts desc, members desc limit 8) t),
    'companies', (select count(*) from public.organizations where type in ('company', 'school') and verification_status = 'verified'),
    'challenges_live', (select count(*) from public.challenges where status in ('open', 'judging')),
    'challenge_entries', (select count(*) from public.challenge_entries),
    'sponsorships_paid', (select count(*) from public.challenges where sponsorship = 'paid'),
    'sponsorships_pilot', (select count(*) from public.challenges where sponsorship = 'pilot'),
    'open_queue', (select count(*) from public.admin_queue where status = 'open')
  ) into r;
  return r;
end $$;

-- slow_down(): from rate-limits.sql
create or replace function public.slow_down(what text) returns void language plpgsql
set search_path = public, extensions, pg_temp as $$
begin
  raise exception 'You''re % faster than Brazework allows. Wait a little and try again.', what using errcode = 'P0001';
end $$;

-- resolve_report(): from reports-more.sql
create or replace function public.resolve_report(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  if p_status not in ('reviewed', 'actioned', 'dismissed') then raise exception 'Unknown status.' using errcode = 'P0001'; end if;
  update public.content_reports set status = p_status, resolved_by = auth.uid(), resolved_at = now() where id = p_id;
  if not found then raise exception 'No such report.' using errcode = 'P0001'; end if;
end $$;

-- decide_school_request(): from school-requests.sql
create or replace function public.decide_school_request(p_id bigint, p_add boolean) returns text
language plpgsql security definer set search_path = public as $$
declare r public.school_requests;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  select * into r from public.school_requests where id = p_id;
  if r.id is null then raise exception 'No such request.' using errcode = 'P0001'; end if;
  if p_add then insert into public.school_domains (domain, school) values (r.domain, r.school) on conflict (domain) do nothing; end if;
  update public.school_requests set status = case when p_add then 'added' else 'dismissed' end, updated_at = now() where id = p_id;
  return case when p_add then 'added' else 'dismissed' end;
end $$;

-- admin_retention(): from admin-retention.sql
create or replace function public.admin_retention() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  with weeks as (
    -- The last 8 weeks that started, oldest first (weeks start on Monday, UTC).
    select generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as wk
  ),
  cohort as (
    select p.id, date_trunc('week', p.created_at) as wk from public.profiles p
    where p.created_at >= (select min(wk) from weeks)
  ),
  acted as (
    select distinct uid, date_trunc('week', at) as wk from (
      select author_id as uid, created_at as at from public.posts
      union all select author_id, created_at from public.comments
      union all select sender_id, created_at from public.messages
      union all select owner_id, created_at from public.milestones
    ) a
    where at >= (select min(wk) from weeks) and uid in (select id from cohort)
  ),
  rows as (
    select w.wk,
      (select count(*) from cohort c where c.wk = w.wk) as size,
      -- For each later week that has started: how many of this cohort were active in it.
      (select coalesce(jsonb_agg(n order by k), '[]'::jsonb) from (
         select k, (select count(distinct a.uid) from acted a join cohort c on c.id = a.uid
                    where c.wk = w.wk and a.wk = w.wk + make_interval(weeks => k)) as n
         from generate_series(1, 8) k
         where w.wk + make_interval(weeks => k) <= date_trunc('week', now())
       ) later) as active
    from weeks w
  ),
  -- Conversations a verified company or school admin started in the last 90 days, and whether the
  -- other person wrote back (and how fast).
  company as (
    select c.id, c.started_by,
      (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id = c.started_by) as first_sent,
      (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id <> c.started_by) as first_reply
    from public.conversations c
    where c.created_at > now() - interval '90 days'
      and exists (select 1 from public.organization_admins oa join public.organizations o on o.id = oa.org_id
                  where oa.uid = c.started_by and o.type in ('company', 'school') and o.verification_status = 'verified')
  )
  select jsonb_build_object(
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk, 'YYYY-MM-DD'), 'size', size, 'active', active) order by wk), '[]'::jsonb) from rows),
    'company_conversations_90d', (select count(*) from company where first_sent is not null),
    'company_replied_90d', (select count(*) from company where first_sent is not null and first_reply is not null),
    'company_median_hours_to_reply', (select round((extract(epoch from percentile_cont(0.5) within group (order by first_reply - first_sent)) / 3600)::numeric, 1)
                                      from company where first_sent is not null and first_reply > first_sent)
  ) into r;
  return r;
end $$;

-- request_club_claim(): from club-claims.sql
create or replace function public.request_club_claim(p_cid text, p_role text, p_evidence text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); new_id bigint;
begin
  if me is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = p_cid) then raise exception 'That club isn''t on Brazework.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.community_members where community_id = p_cid and uid = me and role = 'owner') then
    raise exception 'You already own this club.' using errcode = 'P0001';
  end if;
  if not public.is_school_email((select email from auth.users where id = me)) then
    raise exception 'Claiming a club needs a school email on your account.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.club_claims where claimant = me and status = 'open') >= 3 then
    raise exception 'You have three open claims already. Wait for a decision first.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.club_claims where community_id = p_cid and claimant = me and status = 'open') then
    raise exception 'You already asked to claim this club. A Brazework admin will decide soon.' using errcode = 'P0001';
  end if;
  insert into public.club_claims (community_id, claimant, role_title, evidence)
    values (p_cid, me, btrim(coalesce(p_role, '')), btrim(coalesce(p_evidence, '')))
    returning id into new_id;
  return new_id;
end $$;

-- decide_club_claim(): from club-claims.sql
create or replace function public.decide_club_claim(p_id bigint, p_approve boolean, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare c public.club_claims; old_owner uuid; club_name text;
begin
  if not public.is_forge_admin() then raise exception 'Brazework admins only.' using errcode = '42501'; end if;
  select * into c from public.club_claims where id = p_id for update;
  if c.id is null or c.status <> 'open' then raise exception 'That claim isn''t open.' using errcode = 'P0001'; end if;
  update public.club_claims set status = case when p_approve then 'approved' else 'denied' end,
    decided_by = auth.uid(), decided_at = now(), decision_note = left(btrim(coalesce(p_note, '')), 300)
   where id = p_id;
  select name, owner_id into club_name, old_owner from public.communities where id = c.community_id for update;
  if not p_approve then
    perform public.notify(c.claimant, auth.uid(), 'community_approved', null, null, c.community_id,
      'Your claim to ' || club_name || ' wasn''t approved' || case when btrim(coalesce(p_note, '')) <> '' then ': ' || left(btrim(p_note), 200) else '.' end);
    return;
  end if;
  -- The previous owner(s) stay in the club as members.
  update public.community_members set role = 'member' where community_id = c.community_id and role = 'owner' and uid <> c.claimant;
  insert into public.community_members (community_id, uid, role) values (c.community_id, c.claimant, 'owner')
    on conflict (community_id, uid) do update set role = 'owner';
  update public.communities set owner_id = c.claimant,
    owner_name = coalesce((select btrim(first_name || ' ' || last_name) from public.profiles where id = c.claimant), owner_name)
   where id = c.community_id;
  update public.club_claims set status = 'denied', decided_by = auth.uid(), decided_at = now(), decision_note = 'Another claim was approved.'
   where community_id = c.community_id and status = 'open' and id <> p_id;
  insert into public.club_handoffs (community_id, role, from_uid, to_uid, note)
    values (c.community_id, 'owner', old_owner, c.claimant, left('Claim approved: ' || c.role_title, 300));
  perform public.notify(c.claimant, auth.uid(), 'community_approved', null, null, c.community_id, 'You''re now the owner of ' || club_name);
  if old_owner is not null and old_owner <> c.claimant then
    perform public.notify(old_owner, auth.uid(), 'community_approved', null, null, c.community_id,
      club_name || ' was handed to its officers after a verified claim. You''re still a member.');
  end if;
end $$;

-- The organization the team's own events are posted through (events.sql).
update public.organizations set name = 'Brazework' where type = 'forge' and name = 'Forge';

create or replace function public.brazework_messages_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.brazework_messages_ready() to authenticated;
