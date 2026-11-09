-- What a project is built with: the languages, tools, instruments and machines behind it
-- (Python, ROS 2, SolidWorks, a CNC mill, PCR, an oscilloscope…), up to 12, each 1–40 characters.
-- Shown as a project's "Built with" stack and used to find other projects built with the same tools.
-- Run after projects.sql. Additive only.

create function public.tools_ok(t text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(char_length(btrim(x)) between 1 and 40 and x !~ '[<>]'), true) from unnest(t) as x
$$;

alter table public.projects
  add column tools text[] not null default '{}' check (cardinality(tools) <= 12 and public.tools_ok(tools));
create index projects_tools_idx on public.projects using gin (tools);

-- Owners set it the same way as every other field on their projects.
grant insert (tools) on public.projects to authenticated;
grant update (tools) on public.projects to authenticated;
