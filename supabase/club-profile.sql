-- How a club presents itself: a logo (its profile picture), a one-line tagline, its website, and an
-- accent colour from Forge's palette for its badge and banner. Club admins and owners edit these
-- (the "admins edit communities" rule in schema.sql). Run after media.sql. Additive only.

alter table public.communities
  add column logo_path text not null default ''
    check (logo_path = '' or (char_length(logo_path) <= 300 and logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$')),
  add column tagline text not null default '' check (char_length(tagline) <= 120 and tagline !~ '[<>]'),
  add column website text not null default ''
    check (website = '' or (char_length(website) <= 300 and website ~* '^https?://[^\s<>]+$')),
  add column accent text not null default ''
    check (accent in ('', 'ink', 'blue', 'violet', 'emerald', 'amber', 'rose', 'cyan'));

grant update (logo_path, tagline, website, accent) on public.communities to authenticated;
