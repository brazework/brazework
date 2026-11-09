-- More on a profile: what you're open to (internships, research, co-founding…), up to five links
-- (GitHub, portfolio, LinkedIn…) and where you're based. Run after copilot-chats.sql. Additive:
-- existing profiles start empty. Members edit only their own (profiles' existing update policy).

create function public.profile_links_ok(l jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(l) = 'array' and jsonb_array_length(l) <= 5
     and not exists (
       select 1 from jsonb_array_elements(l) e
        where jsonb_typeof(e) <> 'object'
           or not (e ? 'url') or jsonb_typeof(e -> 'url') <> 'string'
           or char_length(e ->> 'url') > 300 or (e ->> 'url') !~ '^https://[^\s<>"]+$'
           or (e ? 'label' and (jsonb_typeof(e -> 'label') <> 'string' or char_length(e ->> 'label') > 40 or (e ->> 'label') ~ '[<>]')))
$$;

alter table public.profiles
  add column open_to text[] not null default '{}'
    check (cardinality(open_to) <= 4 and open_to <@ array['internships', 'full_time', 'research', 'co_founder', 'collaborators', 'mentoring']::text[]),
  add column links jsonb not null default '[]' check (public.profile_links_ok(links)),
  add column location text not null default '' check (char_length(location) <= 80 and location !~ '[<>]');

grant select (open_to, links, location), update (open_to, links, location) on public.profiles to authenticated;
