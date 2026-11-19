-- Plus, shown honestly (docs/product-hunt.md): on Free, "Companies that looked" names the last 7 days and
-- says how many more verified companies looked in the 90 days before that, so a member sees what Plus
-- would show them before anyone asks for money. Only a count, never which companies: naming them is
-- what Plus is. Never estimated or rounded up: it's the real number, and 0 means no prompt at all.
-- Run after tool-rsvp.sql. Additive: it redefines my_company_viewers() with one more field, `hidden`.
create or replace function public.my_company_viewers(p_days integer default 90) returns jsonb
language sql stable security definer set search_path = public as $$
  with lim as (select least(greatest(coalesce(p_days, 7), 1), case when public.has_plus() then 90 else 7 end) as days),
  v as (
    select viewer, max(viewed_at) as at
      from public.profile_views
     where profile_id = auth.uid() and viewed_at > now() - interval '90 days'
     group by viewer
  ), co as (
    select o.name, max(v.at) as at
      from v
      join public.organization_admins a on a.uid = v.viewer
      join public.organizations o on o.id = a.org_id and o.type = 'company' and o.verification_status = 'verified'
     group by o.name
  ), shown as (
    select co.* from co, lim where co.at > now() - make_interval(days => lim.days)
  )
  select jsonb_build_object(
    'days', (select days from lim),
    'plus', public.has_plus(),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'at', c.at) order by c.at desc) from (select * from shown order by at desc limit 50) c), '[]'::jsonb),
    'hidden', case when public.has_plus() then 0 else (select count(*) from co) - (select count(*) from shown) end)
$$;
revoke execute on function public.my_company_viewers(integer) from public, anon;
grant execute on function public.my_company_viewers(integer) to authenticated;

create or replace function public.plus_teaser_ready() returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.plus_teaser_ready() to authenticated;
