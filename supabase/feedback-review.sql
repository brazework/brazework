-- Weekly feedback review: every Monday the database writes up the past week's member feedback
-- and creates one task in Linear (team Forge, project Forge v1, status Todo, label Feedback) for
-- the founders to read. Run after feedback.sql. Additive: nothing existing changes.
--
-- The review lists new ideas (best grade first), ideas that more members asked for this week,
-- and praise, each with what members said. Weeks without feedback are skipped, so the board
-- doesn't fill up with empty reviews. Decisions stay in each idea's own task.
--
-- Run it by hand any time:  select public.feedback_weekly_review();
-- Read it without sending:  select public.feedback_weekly_markdown();

alter table public.feedback_settings
  add column review_state_id text default '09578346-89ea-430f-a4b1-89e499a2b90e',  -- Todo
  add column review_last_at timestamptz;

-- The week's review as Markdown (the last 7 days, or since the previous review if sooner).
create function public.feedback_weekly_markdown(p_since timestamptz default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := coalesce(p_since, now() - interval '7 days');
  out text; rec record; g record; n_sub int; n_members int; n_new int; n_grown int; n_praise int;
begin
  select count(*), count(distinct user_id) into n_sub, n_members from public.feedback where created_at >= since;
  select count(*) into n_new from public.feedback_themes where first_at >= since and kind <> 'praise';
  select count(distinct t.id) into n_grown from public.feedback_themes t
    where t.first_at < since and t.kind <> 'praise' and exists (select 1 from public.feedback f where f.theme_id = t.id and f.created_at >= since);
  select count(*) into n_praise from public.feedback f join public.feedback_themes t on t.id = f.theme_id
    where f.created_at >= since and t.kind = 'praise';

  out := format(E'**%s %s from %s %s** between %s and %s: %s new %s, %s %s more members asked for, and %s %s of praise.\n\nEach idea has its own task labelled Feedback. Approve one by moving it to Todo with a due date and an owner, or deny it by moving it to Canceled with a one-line reason. Close this review once you''ve been through it.\n',
    n_sub, case when n_sub = 1 then 'submission' else 'submissions' end,
    n_members, case when n_members = 1 then 'member' else 'members' end,
    to_char(since at time zone 'UTC', 'Mon FMDD'), to_char(now() at time zone 'UTC', 'Mon FMDD'),
    n_new, case when n_new = 1 then 'idea' else 'ideas' end,
    n_grown, case when n_grown = 1 then 'idea' else 'ideas' end,
    n_praise, case when n_praise = 1 then 'piece' else 'pieces' end);

  if n_new > 0 then
    out := out || E'\n## New ideas, best grade first\n';
    for rec in
      select t.*, (public.feedback_grade(t.id)).score as score from public.feedback_themes t
      where t.first_at >= since and t.kind <> 'praise'
      order by score desc, t.members desc, t.last_at desc
    loop
      select * into g from public.feedback_grade(rec.id);
      out := out || format(E'\n### %s — Grade %s (%s/9)\n\n%s · %s · %s %s%s\n\n%s\n',
        rec.name, g.letter, g.score, public.feedback_kind_label(rec.kind), public.feedback_area_label(rec.area),
        rec.members, case when rec.members = 1 then 'member' else 'members' end,
        case when rec.linear_identifier is not null then format(' · task [%s](%s)', rec.linear_identifier, rec.linear_url) else '' end,
        (select string_agg(q, E'\n\n') from (select public.feedback_quote(f) q from public.feedback f where f.theme_id = rec.id order by f.created_at desc limit 2) x));
    end loop;
  end if;

  if n_grown > 0 then
    out := out || E'\n## More members asked for these\n';
    for rec in
      select t.*, (select count(*) from public.feedback f where f.theme_id = t.id and f.created_at >= since) as fresh
      from public.feedback_themes t
      where t.first_at < since and t.kind <> 'praise' and exists (select 1 from public.feedback f where f.theme_id = t.id and f.created_at >= since)
      order by fresh desc, t.members desc
    loop
      select * into g from public.feedback_grade(rec.id);
      out := out || format(E'\n### %s — now Grade %s (%s/9)\n\n+%s this week, %s %s in total%s\n\n%s\n',
        rec.name, g.letter, g.score, rec.fresh,
        rec.members, case when rec.members = 1 then 'member' else 'members' end,
        case when rec.linear_identifier is not null then format(' · task [%s](%s)', rec.linear_identifier, rec.linear_url) else '' end,
        (select string_agg(q, E'\n\n') from (select public.feedback_quote(f) q from public.feedback f where f.theme_id = rec.id and f.created_at >= since order by f.created_at desc limit 2) x));
    end loop;
  end if;

  if n_praise > 0 then
    out := out || E'\n## What members liked\n\n' ||
      (select string_agg(q, E'\n\n') from (select public.feedback_quote(f) q from public.feedback f join public.feedback_themes t on t.id = f.theme_id
        where f.created_at >= since and t.kind = 'praise' order by f.created_at desc limit 5) x) || E'\n';
  end if;

  return out || E'\n---\n\n*Written by the Forge database from member feedback. The full history is in the Forge feedback log document.*';
end $$;

-- Creates this week's review task in Linear, unless there was no feedback.
create function public.feedback_weekly_review() returns text
language plpgsql security definer set search_path = public as $$
declare key text; cfg public.feedback_settings; since timestamptz; rid bigint; title text;
begin
  select * into cfg from public.feedback_settings;
  since := greatest(now() - interval '7 days', coalesce(cfg.review_last_at, '-infinity'));
  if not exists (select 1 from public.feedback where created_at >= since) then
    return 'no new feedback since ' || to_char(since at time zone 'UTC', 'Mon FMDD') || ': nothing to review';
  end if;
  select decrypted_secret into key from vault.decrypted_secrets where name = 'linear_api_key' limit 1;
  if key is null or key = '' then return 'no linear_api_key in Vault'; end if;

  title := 'Feedback review · week of ' || to_char(date_trunc('week', now() at time zone 'UTC'), 'Mon FMDD');
  rid := public.feedback_linear(key,
    'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier url } } }',
    jsonb_build_object('input', jsonb_strip_nulls(jsonb_build_object(
      'teamId', cfg.linear_team_id, 'projectId', cfg.linear_project_id, 'stateId', cfg.review_state_id,
      'labelIds', jsonb_build_array(cfg.label_feedback), 'title', title,
      'dueDate', to_char((now() at time zone 'UTC')::date + 2, 'YYYY-MM-DD'),
      'description', public.feedback_weekly_markdown(since)))));
  insert into public.feedback_sync_requests values (rid, 'weekly-review', null, now());
  update public.feedback_settings set review_last_at = now() where id;
  return 'review sent: ' || title;
end $$;

-- Mondays at 13:00 UTC (9 AM Eastern in winter). Skipped where pg_cron isn't installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('forge-feedback-weekly-review', '0 13 * * 1', 'select public.feedback_weekly_review()');
  end if;
exception when others then
  raise notice 'pg_cron not available (%); run select public.feedback_weekly_review() by hand.', sqlerrm;
end $$;

revoke execute on function public.feedback_weekly_markdown(timestamptz), public.feedback_weekly_review() from public, anon, authenticated;
