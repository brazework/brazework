-- Step 42: Pro verification (Linear FIX-72). Working engineers sign off on members' milestones with a
-- written note, as a tier above the club's verification: self-posted < club-verified < Pro-verified.
-- A pro is someone whose confirmed email is at a verified company on Brazework (same rule as company
-- admins: you can't claim an employer you don't have an email at). A sign-off needs a real note (40+
-- characters on what was checked), records who, their title and employer at that moment, and when,
-- and never changes afterwards. Only club-verified, public milestones can be Pro-verified, never your
-- own or a project you're on. Additive and safe to re-run. Run after chapters.sql.

-- ---------- Who's a pro ----------
alter table public.profiles add column if not exists pro_org_id text references public.organizations (id) on delete set null;
alter table public.profiles add column if not exists pro_title text check (pro_title is null or char_length(btrim(pro_title)) between 2 and 80);
alter table public.profiles add column if not exists pro_disciplines text[] not null default '{}' check (cardinality(pro_disciplines) <= 5);
alter table public.profiles add column if not exists pro_since timestamptz;
-- Readable like the rest of a profile (a pro's title and employer show on what they sign); no update
-- grant: they change only through become_pro() below.
grant select (pro_org_id, pro_title, pro_disciplines, pro_since) on public.profiles to authenticated;

-- The verified company at your confirmed email's domain (cs.acme.com → acme.com), if any.
create or replace function public.my_employer() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'name', o.name)
    from auth.users u join public.organizations o
      on o.type = 'company' and o.verification_status = 'verified' and o.domain is not null
     and (split_part(lower(u.email), '@', 2) = o.domain or right(split_part(lower(u.email), '@', 2), char_length(o.domain) + 1) = '.' || o.domain)
   where u.id = auth.uid() and u.email_confirmed_at is not null
   order by char_length(o.domain) desc limit 1
$$;
grant execute on function public.my_employer() to authenticated;

-- Become a pro (or update your title and disciplines): your employer comes from your email, never typed.
create or replace function public.become_pro(p_title text, p_disciplines text[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_org text;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  v_org := public.my_employer()->>'id';
  if v_org is null then raise exception 'Pro reviews need an email at a verified company on Brazework. Log in with your work email, or register your company first.' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 80 then raise exception 'Add your role, like "Senior Mechanical Engineer".' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_disciplines), 0) not between 1 and 5 then raise exception 'Pick 1 to 5 areas you can judge.' using errcode = 'P0001'; end if;
  update public.profiles set pro_org_id = v_org, pro_title = btrim(p_title), pro_disciplines = p_disciplines, pro_since = coalesce(pro_since, now()) where id = auth.uid();
end $$;
revoke execute on function public.become_pro(text, text[]) from anon, public;
grant execute on function public.become_pro(text, text[]) to authenticated;

-- ---------- Sign-offs ----------
create table if not exists public.pro_reviews (
  id bigint generated always as identity primary key,
  milestone_id text not null references public.milestones (id) on delete cascade,
  reviewer uuid not null references public.profiles (id) on delete cascade,
  reviewer_name text not null,
  reviewer_title text not null,
  employer_id text references public.organizations (id) on delete set null,
  employer_name text not null,
  note text not null check (char_length(btrim(note)) between 40 and 1000),
  created_at timestamptz not null default now(),
  unique (milestone_id, reviewer)
);
create index if not exists pro_reviews_milestone_idx on public.pro_reviews (milestone_id);
create index if not exists pro_reviews_reviewer_idx on public.pro_reviews (reviewer, created_at desc);
alter table public.pro_reviews enable row level security;
revoke all on public.pro_reviews from anon, authenticated;
grant select on public.pro_reviews to authenticated;
-- Readable wherever the milestone is: public milestones for everyone, private ones for their owner.
drop policy if exists "read with the milestone" on public.pro_reviews;
create policy "read with the milestone" on public.pro_reviews for select to authenticated
  using (exists (select 1 from public.milestones m where m.id = milestone_id and (m.private = false or m.owner_id = auth.uid())));
-- Never edited: what was signed stays signed (not even the database owner's session changes it by accident).
create or replace function public.pro_reviews_frozen() returns trigger language plpgsql as $$
begin raise exception 'A Pro sign-off can''t be changed.' using errcode = '42501'; end $$;
drop trigger if exists pro_reviews_frozen on public.pro_reviews;
create trigger pro_reviews_frozen before update on public.pro_reviews for each row execute function public.pro_reviews_frozen();

-- Sign off a milestone, with a note on what you checked.
create or replace function public.pro_review_milestone(p_milestone text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_org public.organizations; m public.milestones; v_id bigint;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into v_org from public.organizations where id = me.pro_org_id and verification_status = 'verified';
  if v_org.id is null or me.pro_org_id is distinct from (public.my_employer()->>'id') then
    raise exception 'Set up your Pro profile first (it needs your email at a verified company).' using errcode = '42501';
  end if;
  select * into m from public.milestones where id = p_milestone;
  if m.id is null or m.status <> 'verified' or m.private then raise exception 'Only club-verified, public milestones can be Pro-verified.' using errcode = 'P0001'; end if;
  if m.owner_id = me.id or public.on_project_team(m.project_id, me.id) then raise exception 'You can''t Pro-verify your own work or a project you''re on.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 40 then raise exception 'Say what you checked: at least a sentence or two (40+ characters).' using errcode = 'P0001'; end if;
  if exists (select 1 from public.pro_reviews where milestone_id = m.id and reviewer = me.id) then raise exception 'You''ve already signed this one.' using errcode = 'P0001'; end if;
  insert into public.pro_reviews (milestone_id, reviewer, reviewer_name, reviewer_title, employer_id, employer_name, note)
  values (m.id, me.id, btrim(me.first_name || ' ' || me.last_name), me.pro_title, v_org.id, v_org.name, btrim(p_note))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.pro_review_milestone(text, text) from anon, public;
grant execute on function public.pro_review_milestone(text, text) to authenticated;

-- ---------- The review queue ----------
-- Club-verified public milestones you haven't signed, not yours or your team's, in your areas first
-- (the project's tags overlap your disciplines), oldest first so nothing waits forever.
create or replace function public.pro_review_queue(p_limit integer default 20) returns table (
  id text, title text, detail text, evidence text, achieved_on date, reviewed_at timestamptz, community_id text, community_name text, reviewer_name text,
  project_id text, project_title text, project_tags text[], owner_id uuid, owner_name text, matches boolean, pro_reviews integer
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.pro_org_id is null then raise exception 'Set up your Pro profile first.' using errcode = '42501'; end if;
  return query
  select m.id, m.title, m.detail, m.evidence, m.achieved_on, m.reviewed_at, m.community_id, m.community_name, m.reviewer_name,
         p.id, p.title, p.tags, m.owner_id, btrim(pr.first_name || ' ' || pr.last_name),
         (p.tags && me.pro_disciplines),
         (select count(*)::int from public.pro_reviews r where r.milestone_id = m.id)
    from public.milestones m
    join public.projects p on p.id = m.project_id and p.private = false
    join public.profiles pr on pr.id = m.owner_id
   where m.status = 'verified' and m.private = false and m.owner_id <> me.id
     and not public.on_project_team(m.project_id, me.id)
     and not exists (select 1 from public.pro_reviews r where r.milestone_id = m.id and r.reviewer = me.id)
   order by (p.tags && me.pro_disciplines) desc, m.reviewed_at asc nulls last
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;
revoke execute on function public.pro_review_queue(integer) from anon, public;
grant execute on function public.pro_review_queue(integer) to authenticated;

-- Lets the app check this step has run (lib/db-features.ts).
create or replace function public.pro_verification_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.pro_verification_ready() to authenticated;
