-- Member feedback: captured on Forge, grouped into ideas, graded, and sent to Linear.
-- Run after post-edits.sql. Additive: nothing existing changes.
--
-- How it works
-- 1. A member sends feedback from Forge updates (submit_feedback()). It's stored with its type,
--    the part of Forge it's about, and whether we may contact them.
-- 2. The database groups it with similar feedback into one idea ("theme") by comparing wording
--    (letter-level similarity, plus shared word stems after dropping filler words), and names
--    new ideas in plain English.
-- 3. Each idea is graded: how many members asked, whether it's a problem, whether it's recent,
--    and whether both students and professionals asked.
-- 4. feedback_sync() sends ideas to Linear (team Forge, project Forge v1, label Feedback) as one
--    task per idea, to approve or deny. New feedback on an idea updates its task and adds a
--    comment instead of opening a new one. It also keeps a "Forge feedback log" document in the
--    project up to date. It runs right after each submission and every 2 minutes.
--
-- Linear needs an API key in Supabase Vault, added by a founder (never stored in the repo):
--   select vault.create_secret('<Linear personal API key>', 'linear_api_key');
-- Until then everything is captured and grouped, and the sync catches up once the key exists.
--
-- Members can read only their own feedback. Ideas, grades and sync state are invisible to clients.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_net;

-- ---------- Settings: where in Linear things go (ids, not secrets) ----------

create table public.feedback_settings (
  id boolean primary key default true check (id),
  linear_team_id text not null,
  linear_project_id text,
  linear_state_id text,                -- where new tasks start (Backlog)
  label_feedback text not null,
  label_idea text, label_problem text, label_improvement text,
  log_doc_id uuid not null default gen_random_uuid(),
  log_doc_state text not null default 'pending' check (log_doc_state in ('pending', 'creating', 'created')),
  log_doc_url text,
  log_needs_sync boolean not null default true,
  group_threshold real not null default 0.32
);
insert into public.feedback_settings (linear_team_id, linear_project_id, linear_state_id, label_feedback, label_idea, label_problem, label_improvement)
values ('e9a4549f-0bad-4ef4-a105-e907d69ab2ca', '6e04fc9f-9a70-4361-8612-66bc29f03742', '5564fb15-10a6-4c1b-bb5a-18d1dd79bd5d',
        'bb01912d-f70f-418a-a25c-56fcb91780ed', '73414f59-90fc-4b94-8dd9-b01e0fe4e631', '98dfa501-3d69-4798-9045-14ad1ef0d108', '6678bce5-5c2e-4f3f-881d-9a0e3142cce2');

-- ---------- Ideas (themes) and feedback ----------

-- A theme's id is also its Linear task's id, so the database never has to look the task up.
create table public.feedback_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,
  area text not null,
  members integer not null default 0,
  submissions integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  linear_state text not null default 'pending' check (linear_state in ('pending', 'creating', 'created', 'skipped')),
  linear_identifier text,
  linear_url text,
  linear_attempts integer not null default 0,
  needs_sync boolean not null default true,
  synced_at timestamptz
);

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null check (kind in ('idea', 'problem', 'improvement', 'praise')),
  area text not null check (area in ('general', 'feed', 'search', 'profiles', 'communities', 'messages', 'events', 'network', 'notifications', 'other')),
  body text not null check (char_length(body) between 10 and 1000),
  norm text not null default '',
  may_contact boolean not null default false,
  theme_id uuid references public.feedback_themes (id) on delete set null,
  linear_noted boolean not null default false,  -- already in its Linear task (description or a comment)
  created_at timestamptz not null default now()
);
create index feedback_user_idx on public.feedback (user_id, created_at desc);
create index feedback_theme_idx on public.feedback (theme_id, created_at desc);
create index feedback_norm_trgm on public.feedback using gin (norm extensions.gin_trgm_ops);

-- Requests waiting for Linear's answer (pg_net is asynchronous).
create table public.feedback_sync_requests (
  request_id bigint primary key,
  action text not null,
  theme_id uuid,
  created_at timestamptz not null default now()
);

revoke all on public.feedback_settings, public.feedback_themes, public.feedback, public.feedback_sync_requests from anon, authenticated;
alter table public.feedback_settings enable row level security;
alter table public.feedback_themes enable row level security;
alter table public.feedback enable row level security;
alter table public.feedback_sync_requests enable row level security;
grant select (id, kind, area, body, may_contact, created_at) on public.feedback to authenticated;
create policy "your own feedback" on public.feedback for select to authenticated using (user_id = auth.uid());

-- ---------- Words ----------

create function public.feedback_area_label(a text) returns text language sql immutable as $$
  select case a
    when 'feed' then 'Feed' when 'search' then 'Search' when 'profiles' then 'Profiles & projects'
    when 'communities' then 'Communities' when 'messages' then 'Messages' when 'events' then 'Events'
    when 'network' then 'Network' when 'notifications' then 'Notifications' when 'other' then 'Other'
    else 'General' end
$$;

create function public.feedback_kind_label(k text) returns text language sql immutable as $$
  select case k when 'problem' then 'Problem' when 'improvement' then 'Improvement' when 'praise' then 'Praise' else 'Idea' end
$$;

-- One word for a few common ways of saying the same thing ("laggy", "takes a long time" -> slow).
create function public.feedback_synonym(w text) returns text language sql immutable as $$
  select case
    when w in ('slow', 'slowly', 'lag', 'laggy', 'lagging', 'delay', 'delayed', 'long', 'forever', 'sluggish') then 'slow'
    when w in ('appear', 'appears', 'show', 'shows', 'showing', 'load', 'loads', 'loading', 'display', 'displays') then 'appear'
    when w in ('crash', 'crashes', 'crashed', 'broken', 'break', 'breaks', 'bug', 'buggy', 'error', 'errors') then 'broken'
    when w in ('photo', 'photos', 'picture', 'pictures', 'image', 'images', 'pic', 'pics') then 'photo'
    when w in ('school', 'schools', 'university', 'universities', 'college', 'colleges', 'campus') then 'school'
    when w in ('dark', 'theme', 'themes', 'darkmode') then 'theme'
    when w in ('calendar', 'calendars', 'schedule', 'agenda') then 'calendar'
    else w end
$$;

-- Lowercase word stems that carry meaning, for comparing feedback ("messages" and "message" match).
-- Filler words don't count.
create function public.feedback_normalize(t text) returns text language sql immutable as $$
  select coalesce(string_agg(s, ' '), '')
  from (
    select case when w2 ~ 'ies$' and char_length(w2) > 4 then regexp_replace(w2, 'ies$', 'y')
                when w2 ~ '[^s]s$' and char_length(w2) > 3 then left(w2, -1)
                when w2 ~ '(ing|ed)$' and char_length(w2) > 5 then regexp_replace(w2, '(ing|ed)$', '')
                else w2 end s
    from (select public.feedback_synonym(w) w2 from regexp_split_to_table(regexp_replace(lower(t), '[^a-z0-9+#]+', ' ', 'g'), '\s+') w
          where char_length(w) > 2 and w not in (
    'the','and','for','you','your','with','that','this','are','was','were','have','has','had','would','could','should',
    'can','will','just','like','really','very','also','please','think','feel','wish','want','love','nice','great','cool',
    'good','able','its','it''s','but','not','all','any','some','there','their','them','they','what','when','where','how',
    'why','who','from','into','about','more','much','make','made','get','got','maybe','something','thing','things',
    'forge','app','site','website','page','option','way','add','see','use','using','one','i''d','i''m')) a
  ) b
$$;

-- Share of meaningful words two pieces of feedback have in common (of the shorter one), when they
-- share at least 2. Catches the same idea in different words, which letter-level similarity misses.
-- Words naming a part of Forge don't count here: feedback is already compared within one area,
-- so "message" in two pieces of Messages feedback says nothing about whether they're the same idea.
create function public.feedback_overlap(a text, b text) returns real language sql immutable as $$
  with skip as (select unnest(array['message','search','event','feed','profile','project','community','network',
                                     'notification','post','member','user','people','person']) w),
       x as (select distinct unnest(string_to_array(a, ' ')) w except select w from skip),
       y as (select distinct unnest(string_to_array(b, ' ')) w except select w from skip),
       c as (select count(*) n from x join y using (w))
  select case when (select n from c) < 2 then 0
              else (select n from c)::real / greatest(least((select count(*) from x), (select count(*) from y)), 1) end
$$;

-- A short, natural name for a new idea, from what the member wrote:
-- "It would be nice if I could filter people by school." -> "Search · Filter people by school"
create function public.feedback_name(body text, area text) returns text language plpgsql immutable as $$
declare s text; prev text; words text[];
begin
  s := btrim(split_part(regexp_replace(body, '\s+', ' ', 'g'), E'\n', 1));
  s := btrim((regexp_match(s || '.', '^(.*?)[.!?](\s|$)'))[1]);
  loop
    prev := s;
    s := regexp_replace(s, '^(hi|hey|hello|so|ok|okay|also|honestly|overall)[,!]?\s+', '', 'i');
    s := regexp_replace(s, '^(i think|i feel like|i feel|i wish|i would really like|i would like|i''d like|i''d love|i would love|i really want|i want|we need|we want|i need)\s+(it would be|to have|to be able to|to|that|if|there was|there were)?\s*', '', 'i');
    s := regexp_replace(s, '^(it would be|would be|it''d be|it is|it''s)\s+(really\s+|so\s+)?(nice|great|cool|good|helpful|awesome|useful|amazing)\s+(if|to|to have)\s+', '', 'i');
    s := regexp_replace(s, '^(can you|could you|can we|could we|can forge|could forge|please|you should|forge should|there should be|we should have|maybe)\s+(please\s+)?', '', 'i');
    s := regexp_replace(s, '^(i|we|users|people|members)\s+(could|can|would be able to|should be able to|be able to)\s+', '', 'i');
    s := regexp_replace(s, '^(let us|let me|allow us to|allow me to|allow users to|let users)\s+', '', 'i');
    s := regexp_replace(s, '^(add|have)\s+(a|an|the|some)?\s*(option|way|feature|ability)\s+(to|for)\s+', '', 'i');
    exit when s = prev;
  end loop;
  s := regexp_replace(s, '\s*(please|thanks|thank you)[!.]*$', '', 'i');
  s := regexp_replace(btrim(s), '[.!?,;:]+$', '');
  s := regexp_replace(s, '\s+(would|will|could)\s+(really\s+)?(help|be (nice|great|cool|good|helpful|awesome|useful|amazing))$', '', 'i');
  words := regexp_split_to_array(btrim(s), '\s+');
  -- End at a natural break once the main point is made ("...by school when searching" -> "...by school").
  for i in 4 .. coalesce(array_length(words, 1), 0) loop
    if lower(words[i]) in ('when', 'so', 'because', 'since', 'which', 'while', 'after', 'before', 'but', 'as') then
      words := words[1:i - 1];
      exit;
    end if;
  end loop;
  if array_length(words, 1) > 9 then
    words := words[1:9];
  end if;
  -- Don't stop on a dangling little word ("...to our").
  while array_length(words, 1) > 3 and lower(words[array_length(words, 1)]) in ('a','an','the','to','of','for','and','or','with','in','on','by','my','our','your','their','it','is','that','if') loop
    words := words[1:array_length(words, 1) - 1];
  end loop;
  s := btrim(array_to_string(words, ' '), ' ,;:-');
  if char_length(s) < 4 or coalesce(array_length(words, 1), 0) < 2 then
    s := 'Feedback about ' || lower(public.feedback_area_label(area));
  end if;
  s := upper(left(s, 1)) || substr(s, 2);
  -- Prefix the part of Forge, unless the name already starts with it ("Messages take…", "Search for…").
  return case when area in ('general', 'other') or lower(s) like lower(left(public.feedback_area_label(area), 5)) || '%' then s
              else public.feedback_area_label(area) || ' · ' || s end;
end $$;

-- ---------- Grade ----------

-- Demand (members who asked, up to 5), pain (problems weigh more), momentum (mentioned in the
-- last 2 weeks) and breadth (students and professionals both asked). Out of 9:
-- A 7+, B 5-6, C 3-4, D 0-2.
create function public.feedback_grade(t uuid) returns table (score integer, letter text, reasons text[])
language plpgsql stable security definer set search_path = public as $$
declare th public.feedback_themes; demand int; pain int; momentum int; breadth int; s int; kinds int;
begin
  select * into th from public.feedback_themes where id = t;
  demand := case when th.members >= 10 then 5 when th.members >= 5 then 4 when th.members >= 3 then 3 else greatest(th.members, 1) end;
  pain := case when exists (select 1 from public.feedback where theme_id = t and kind = 'problem') then 2
               when th.kind = 'praise' then 0 else 1 end;
  momentum := case when th.last_at > now() - interval '14 days' then 1 else 0 end;
  select count(distinct p.account_type) into kinds from public.feedback f join public.profiles p on p.id = f.user_id where f.theme_id = t;
  breadth := case when kinds >= 2 then 1 else 0 end;
  s := demand + pain + momentum + breadth;
  return query select s,
    case when s >= 7 then 'A' when s >= 5 then 'B' when s >= 3 then 'C' else 'D' end,
    array_remove(array[
      format('Demand: %s %s asked (+%s)', th.members, case when th.members = 1 then 'member' else 'members' end, demand),
      case when pain = 2 then 'Pain: at least one member reported it as a problem (+2)'
           when pain = 1 then 'Pain: a request, not a problem (+1)' else 'Pain: praise, nothing to fix (+0)' end,
      case when momentum = 1 then 'Momentum: mentioned in the last 2 weeks (+1)' else 'Momentum: quiet for 2 weeks or more (+0)' end,
      case when breadth = 1 then 'Breadth: students and professionals both asked (+1)' else null end
    ], null);
end $$;

-- ---------- Submitting ----------

create function public.submit_feedback(p_kind text, p_area text, p_body text, p_may_contact boolean default false)
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
  if p_area not in ('general', 'feed', 'search', 'profiles', 'communities', 'messages', 'events', 'network', 'notifications', 'other') then raise exception 'Choose which part of Forge this is about.' using errcode = '22023'; end if;
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

-- ---------- Markdown for Linear ----------

create function public.feedback_quote(f public.feedback) returns text language sql stable security definer set search_path = public as $$
  select '> ' || replace(f.body, E'\n', E'\n> ') || E'\n>\n> — ' ||
    case when f.may_contact and p.id is not null then p.first_name || ' ' || p.last_name || ', ' else '' end ||
    case p.account_type when 'student' then 'a student' when 'professional' then 'a professional' else 'a member' end ||
    coalesce(nullif(' in ' || coalesce(p.field, ''), ' in '), '') ||
    ' · ' || to_char(f.created_at at time zone 'UTC', 'Mon FMDD') ||
    case when f.may_contact then ' · happy to be contacted' else '' end
  from (select 1) x left join public.profiles p on p.id = f.user_id
$$;

create function public.feedback_theme_markdown(t uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare th public.feedback_themes; g record; quotes text; more int;
begin
  select * into th from public.feedback_themes where id = t;
  select * into g from public.feedback_grade(t);
  select string_agg(q, E'\n\n') into quotes from (
    select public.feedback_quote(f) q from public.feedback f where f.theme_id = t order by f.created_at desc limit 8) x;
  select greatest(count(*) - 8, 0) into more from public.feedback where theme_id = t;
  return format(E'**%s from Forge members** · %s\n\n%s %s asked for this (%s %s). First mentioned %s, most recently %s.\n\n### What members are saying\n\n%s%s\n\n### Grade: %s (%s of 9)\n\n%s\n\n### Your decision\n\n* **Approve:** move this to Todo, then set a due date and an owner.\n* **Deny:** move it to Canceled and leave a one-line reason in a comment.\n\n---\n\n*Grouped automatically from member feedback. This description updates as new feedback arrives; new feedback is also added as a comment. Theme %s.*',
    public.feedback_kind_label(th.kind), public.feedback_area_label(th.area),
    th.members, case when th.members = 1 then 'member has' else 'members have' end,
    th.submissions, case when th.submissions = 1 then 'submission' else 'submissions' end,
    to_char(th.first_at at time zone 'UTC', 'Mon FMDD, YYYY'), to_char(th.last_at at time zone 'UTC', 'Mon FMDD, YYYY'),
    coalesce(quotes, '_No quotes yet._'),
    case when more > 0 then format(E'\n\n_…and %s older %s._', more, case when more = 1 then 'submission' else 'submissions' end) else '' end,
    g.letter, g.score,
    (select string_agg('* ' || r, E'\n') from unnest(g.reasons) r),
    th.id);
end $$;

-- The log document: every idea, best grade first, then praise.
create function public.feedback_log_markdown() returns text
language plpgsql stable security definer set search_path = public as $$
declare out text; total_ideas int; total_members int; rec record; g record;
begin
  select count(*) into total_ideas from public.feedback_themes;
  select count(distinct user_id) into total_members from public.feedback;
  out := format(E'Updated %s UTC. **%s %s** from **%s %s**, grouped by topic and graded. Each idea (except praise) is a task in this project labelled Feedback: approve it by moving it to Todo, or deny it by moving it to Canceled.\n\n**How grades work (out of 9):** demand (members who asked, up to 5) + pain (2 for a problem, 1 for a request) + momentum (1 if mentioned in the last 2 weeks) + breadth (1 if students and professionals both asked). A is 7+, B 5-6, C 3-4, D 0-2.\n',
    to_char(now() at time zone 'UTC', 'Mon FMDD, YYYY "at" FMHH12:MI AM'),
    total_ideas, case when total_ideas = 1 then 'idea' else 'ideas' end,
    total_members, case when total_members = 1 then 'member' else 'members' end);
  if total_ideas = 0 then return out || E'\n_No feedback yet._'; end if;

  out := out || E'\n## Ideas by grade\n';
  for rec in
    select t.*, (public.feedback_grade(t.id)).score as score
    from public.feedback_themes t where t.kind <> 'praise'
    order by score desc, t.members desc, t.last_at desc
  loop
    select * into g from public.feedback_grade(rec.id);
    out := out || format(E'\n### %s — Grade %s (%s/9)\n\n%s · %s · %s %s · last mentioned %s%s\n\n%s\n',
      rec.name, g.letter, g.score,
      public.feedback_kind_label(rec.kind), public.feedback_area_label(rec.area),
      rec.members, case when rec.members = 1 then 'member' else 'members' end,
      to_char(rec.last_at at time zone 'UTC', 'Mon FMDD'),
      case when rec.linear_identifier is not null then format(' · task [%s](%s)', rec.linear_identifier, rec.linear_url) else '' end,
      (select string_agg(q, E'\n\n') from (select public.feedback_quote(f) q from public.feedback f where f.theme_id = rec.id order by f.created_at desc limit 3) x));
  end loop;

  if exists (select 1 from public.feedback_themes where kind = 'praise') then
    out := out || E'\n## What members like\n';
    for rec in select * from public.feedback_themes where kind = 'praise' order by members desc, last_at desc loop
      out := out || format(E'\n### %s (%s %s)\n\n%s\n', rec.name, rec.members, case when rec.members = 1 then 'member' else 'members' end,
        (select string_agg(q, E'\n\n') from (select public.feedback_quote(f) q from public.feedback f where f.theme_id = rec.id order by f.created_at desc limit 3) x));
    end loop;
  end if;
  return out;
end $$;

-- ---------- Sending to Linear ----------

create function public.feedback_linear(key text, query text, variables jsonb) returns bigint
language sql security definer set search_path = public as $$
  select net.http_post(
    url := 'https://api.linear.app/graphql',
    body := jsonb_build_object('query', query, 'variables', variables),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', key),
    timeout_milliseconds := 10000)
$$;

create function public.feedback_sync() returns text
language plpgsql security definer set search_path = public as $$
declare
  key text; cfg public.feedback_settings; r record; th public.feedback_themes; f public.feedback;
  resp jsonb; ok boolean; rid bigint; sent int := 0; labels text[];
begin
  -- 1. Read Linear's answers to earlier requests.
  for r in
    select q.*, h.status_code, h.content, h.error_msg
    from public.feedback_sync_requests q left join net._http_response h on h.id = q.request_id
    where h.id is not null or q.created_at < now() - interval '10 minutes'
  loop
    resp := case when r.content is not null and left(btrim(r.content), 1) = '{' then r.content::jsonb else null end;
    ok := coalesce(r.status_code = 200 and resp is not null and resp->'errors' is null, false);
    if r.action = 'create' then
      if ok then
        update public.feedback_themes set linear_state = 'created',
          linear_identifier = resp #>> '{data,issueCreate,issue,identifier}', linear_url = resp #>> '{data,issueCreate,issue,url}'
        where id = r.theme_id;
        update public.feedback_settings set log_needs_sync = true where id;
      elsif resp::text ilike '%already exists%' or resp::text ilike '%duplicate%' then
        update public.feedback_themes set linear_state = 'created', needs_sync = true where id = r.theme_id;
      else
        update public.feedback_themes set linear_state = 'pending', needs_sync = true where id = r.theme_id;
        update public.feedback set linear_noted = false where theme_id = r.theme_id;
      end if;
    elsif r.action = 'doc-create' then
      update public.feedback_settings set log_doc_state = case when ok or resp::text ilike '%already exists%' then 'created' else 'pending' end,
        log_doc_url = coalesce(resp #>> '{data,documentCreate,document,url}', log_doc_url),
        log_needs_sync = log_needs_sync or not ok
      where id;
    elsif not ok and r.theme_id is not null then
      update public.feedback_themes set needs_sync = true where id = r.theme_id;
    end if;
    delete from public.feedback_sync_requests where request_id = r.request_id;
  end loop;

  -- 2. Nothing goes out without a key.
  select decrypted_secret into key from vault.decrypted_secrets where name = 'linear_api_key' limit 1;
  if key is null or key = '' then return 'no linear_api_key in Vault: feedback is stored and grouped, waiting to sync'; end if;
  select * into cfg from public.feedback_settings;

  -- 3. One task per idea; updates and comments for ideas that already have one.
  for th in
    select * from public.feedback_themes
    where needs_sync and linear_state in ('pending', 'created') and linear_attempts < 20
    order by last_at limit 20
  loop
    if th.linear_state = 'pending' then
      labels := array_remove(array[cfg.label_feedback,
        case th.kind when 'problem' then cfg.label_problem when 'improvement' then cfg.label_improvement else cfg.label_idea end], null);
      rid := public.feedback_linear(key,
        'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }',
        jsonb_build_object('input', jsonb_strip_nulls(jsonb_build_object(
          'id', th.id, 'teamId', cfg.linear_team_id, 'projectId', cfg.linear_project_id, 'stateId', cfg.linear_state_id,
          'labelIds', to_jsonb(labels), 'title', th.name, 'description', public.feedback_theme_markdown(th.id)))));
      insert into public.feedback_sync_requests values (rid, 'create', th.id, now());
      update public.feedback_themes set linear_state = 'creating', linear_attempts = linear_attempts + 1, needs_sync = false, synced_at = now() where id = th.id;
      update public.feedback set linear_noted = true where theme_id = th.id;
    else
      -- Keep the description current (title, status, labels, dates stay yours to change).
      rid := public.feedback_linear(key,
        'mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }',
        jsonb_build_object('id', th.id, 'input', jsonb_build_object('description', public.feedback_theme_markdown(th.id))));
      insert into public.feedback_sync_requests values (rid, 'update', th.id, now());
      -- Each new piece of feedback becomes a comment, so it shows up in your Linear inbox.
      for f in select * from public.feedback where theme_id = th.id and not linear_noted order by created_at loop
        rid := public.feedback_linear(key,
          'mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }',
          jsonb_build_object('input', jsonb_build_object('issueId', th.id,
            'body', format(E'New feedback joined this idea (now %s %s):\n\n%s', th.members, case when th.members = 1 then 'member' else 'members' end, public.feedback_quote(f)))));
        insert into public.feedback_sync_requests values (rid, 'comment', th.id, now());
        update public.feedback set linear_noted = true where id = f.id;
      end loop;
      update public.feedback_themes set needs_sync = false, synced_at = now() where id = th.id;
    end if;
    sent := sent + 1;
  end loop;

  -- 4. The log document in the project.
  if cfg.log_needs_sync and cfg.log_doc_state <> 'creating' then
    if cfg.log_doc_state = 'pending' then
      rid := public.feedback_linear(key,
        'mutation($input: DocumentCreateInput!) { documentCreate(input: $input) { success document { id url } } }',
        jsonb_build_object('input', jsonb_strip_nulls(jsonb_build_object('id', cfg.log_doc_id, 'title', 'Forge feedback log',
          'projectId', cfg.linear_project_id, 'content', public.feedback_log_markdown()))));
      insert into public.feedback_sync_requests values (rid, 'doc-create', null, now());
      update public.feedback_settings set log_doc_state = 'creating', log_needs_sync = false where id;
    else
      rid := public.feedback_linear(key,
        'mutation($id: String!, $input: DocumentUpdateInput!) { documentUpdate(id: $id, input: $input) { success } }',
        jsonb_build_object('id', cfg.log_doc_id, 'input', jsonb_build_object('content', public.feedback_log_markdown())));
      insert into public.feedback_sync_requests values (rid, 'doc-update', null, now());
      update public.feedback_settings set log_needs_sync = false where id;
    end if;
  end if;
  return format('sent %s %s', sent, case when sent = 1 then 'idea' else 'ideas' end);
end $$;

-- Every 2 minutes: read answers, retry anything that failed, keep the log fresh.
-- (Skipped where pg_cron isn't installed, e.g. the CI database.)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('forge-feedback-sync', '*/2 * * * *', 'select public.feedback_sync()');
  end if;
exception when others then
  raise notice 'pg_cron not available (%); feedback still syncs after each submission.', sqlerrm;
end $$;

revoke execute on function public.feedback_area_label(text), public.feedback_kind_label(text), public.feedback_normalize(text),
  public.feedback_synonym(text), public.feedback_overlap(text, text), public.feedback_name(text, text), public.feedback_grade(uuid), public.feedback_quote(public.feedback),
  public.feedback_theme_markdown(uuid), public.feedback_log_markdown(), public.feedback_linear(text, text, jsonb),
  public.feedback_sync(), public.submit_feedback(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_feedback(text, text, text, boolean) to authenticated;
