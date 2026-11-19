-- Step 70: proof without revealing confidential work. Run after mcp-workflows.sql. Additive and safe
-- to re-run.
--
-- A private milestone (or one on a private project) can carry one public line its owner writes, like
-- "Shipped a payments migration". Other members then see that line with who stands behind it in
-- general terms ("signed by a manager at a verified company", "verified by a club's officers") and
-- the month. Nothing else about it: never the title, detail, evidence, project, signer's name, email
-- domain or club.
--   - Only the owner writes the line (set_public_line); it isn't in any column grant, so no one can
--     write it directly. Up to 140 characters, no markup, and not the private title itself.
--   - Only signed (verified) milestones show it; a draft, a pending ask or a revoked one shows nothing.
--   - redacted_proof() is the only way to read it, for members (as the rest of a profile is).

alter table public.milestones add column if not exists public_line text not null default '';
alter table public.milestones drop constraint if exists milestones_public_line_ok;
alter table public.milestones add constraint milestones_public_line_ok
  check (char_length(public_line) <= 140 and public_line !~ '[<>\r\n]');

create or replace function public.set_public_line(p_id text, p_line text) returns text
language plpgsql security definer set search_path = public as $$
declare m public.milestones; proj_private boolean; ln text := btrim(regexp_replace(coalesce(p_line, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then raise exception 'Log in again.' using errcode = '42501'; end if;
  select * into m from public.milestones where id = p_id for update;
  if m.id is null or m.owner_id <> auth.uid() then raise exception 'Only the owner writes this line.' using errcode = '42501'; end if;
  select p.private into proj_private from public.projects p where p.id = m.project_id;
  if char_length(ln) > 140 then raise exception 'Keep it to one line (140 characters).' using errcode = 'P0001'; end if;
  if ln ~ '[<>]' then raise exception 'Leave out < and >.' using errcode = 'P0001'; end if;
  if ln <> '' and not (m.private or coalesce(proj_private, false)) then
    raise exception 'This milestone is already public, so it doesn''t need a public line.' using errcode = 'P0001';
  end if;
  if ln <> '' and lower(ln) = lower(btrim(m.title)) then
    raise exception 'That''s the private title. Say what it was in general terms, without names or details you can''t share.' using errcode = 'P0001';
  end if;
  update public.milestones set public_line = ln where id = m.id;
  return ln;
end $$;
revoke execute on function public.set_public_line(text, text) from anon, public;
grant execute on function public.set_public_line(text, text) to authenticated;

-- A member's confidential work, as other members see it: the line, who stands behind it in general
-- terms, and the month it was signed. Newest first.
create or replace function public.redacted_proof(p_member uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'line', m.public_line,
      'month', to_char(coalesce(m.reviewed_at, m.achieved_on::timestamptz), 'YYYY-MM'),
      'signer', case
        when m.vouched_by <> '' then jsonb_build_object('kind', 'vouch', 'role', m.reviewer_role,
          'org', case when public.is_school_email((select v.email from public.milestone_vouches v where v.milestone_id = m.id and v.state = 'vouched' order by v.answered_at desc limit 1))
                      then 'university' else 'company' end)
        else jsonb_build_object('kind', 'club') end,
      'pro', exists (select 1 from public.pro_reviews r where r.milestone_id = m.id))
    order by coalesce(m.reviewed_at, m.achieved_on::timestamptz) desc), '[]')
  from public.milestones m
  join public.projects p on p.id = m.project_id
  where auth.uid() is not null and public.is_member()
    and m.owner_id = p_member and m.public_line <> '' and m.status = 'verified' and (m.private or p.private)
$$;
revoke execute on function public.redacted_proof(uuid) from anon, public;
grant execute on function public.redacted_proof(uuid) to authenticated;

-- ---------- So the app (and the health check) can tell this step has run ----------
create or replace function public.redacted_proof_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.redacted_proof_ready() to authenticated;
