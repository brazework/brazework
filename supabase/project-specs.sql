-- Project specs: a short list of label/value pairs for hardware and research projects ("Mass: 1.2
-- kg", "Thrust: 2 kN", "Material: 6061 aluminium"), shown as a table on the project. Same read rule
-- as the write-up (project_details). Run after club-reports.sql. Additive.

create function public.project_specs_ok(s jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(s) = 'array' and jsonb_array_length(s) <= 16
    and not exists (
      select 1 from jsonb_array_elements(s) e
      where jsonb_typeof(e) <> 'object'
         or char_length(coalesce(e->>'label', '')) not between 1 and 40
         or char_length(coalesce(e->>'value', '')) not between 1 and 80
         or (select count(*) from jsonb_object_keys(e)) <> 2)
$$;

alter table public.project_details add column specs jsonb not null default '[]'::jsonb
  constraint project_details_specs_ok check (public.project_specs_ok(specs));
grant insert (specs), update (specs) on public.project_details to authenticated;
