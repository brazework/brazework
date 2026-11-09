-- Photos and video: profile photos and cover banners, club covers, and up to 4 photos or 1 video
-- per post. Run after club-events.sql. Additive: nothing existing changes.
--
-- Files live in one public Storage bucket, "media", always under the uploader's own folder
-- (<user id>/...). Rows store the file's path, never a full URL, and the database checks that
-- every path is in the right person's folder, so nobody can point at someone else's files.

-- ---------- Storage bucket (skipped where Storage isn't installed, e.g. the CI database) ----------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 52428800,  -- 50 MB
            array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "media: upload to your own folder" on storage.objects';
    execute $p$create policy "media: upload to your own folder" on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute 'drop policy if exists "media: delete your own files" on storage.objects';
    execute $p$create policy "media: delete your own files" on storage.objects for delete to authenticated
      using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

-- A stored path must sit in the given person's folder: "<uid>/<file>", nothing outside it.
create function public.media_path_ok(p text, owner uuid) returns boolean
language sql immutable as $$
  select p = '' or (char_length(p) <= 300 and p ~ ('^' || owner::text || '/[A-Za-z0-9._-]+$'))
$$;

-- Post media: up to 4 photos, or exactly 1 video. Each item:
--   { "type": "image" | "video", "path": "<uid>/<file>", "w": 1600, "h": 900,
--     "alt":   "what the photo shows" (photos, <= 200 chars),
--     "notes": [{ "x": 0.42, "y": 0.31, "t": "Servo mount" }]   callouts pinned on a photo (<= 6, x/y in 0..1),
--     "marks": [{ "s": 3.2, "t": "Ignition" }]                   moments on a video's timeline (<= 8, 0..3600 s),
--     "cmp":   true                                               both photos of a 2-photo before/after post }
-- Unknown keys are rejected. Types are checked before values are read, so bad input returns false
-- instead of raising a cast error.
create function public.post_media_ok(m jsonb, owner uuid) returns boolean
language plpgsql immutable as $$
declare
  e jsonb;
  n jsonb;
  images int := 0;
  videos int := 0;
  cmps int := 0;
begin
  if m is null or jsonb_typeof(m) <> 'array' or jsonb_array_length(m) > 4 then return false; end if;
  for e in select value from jsonb_array_elements(m) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(e) k where k not in ('type', 'path', 'w', 'h', 'alt', 'notes', 'marks', 'cmp')) then return false; end if;
    if coalesce(e->>'type', '') not in ('image', 'video') then return false; end if;
    if jsonb_typeof(e->'path') is distinct from 'string' or e->>'path' = '' or not public.media_path_ok(e->>'path', owner) then return false; end if;
    if (e ? 'w' and jsonb_typeof(e->'w') <> 'number') or (e ? 'h' and jsonb_typeof(e->'h') <> 'number') then return false; end if;
    if e ? 'alt' then
      if jsonb_typeof(e->'alt') <> 'string' or char_length(e->>'alt') > 200 then return false; end if;
    end if;
    if e ? 'notes' then
      if e->>'type' <> 'image' or jsonb_typeof(e->'notes') <> 'array' or jsonb_array_length(e->'notes') > 6 then return false; end if;
      for n in select value from jsonb_array_elements(e->'notes') loop
        if jsonb_typeof(n) <> 'object' then return false; end if;
        if jsonb_typeof(n->'x') is distinct from 'number' or jsonb_typeof(n->'y') is distinct from 'number' or jsonb_typeof(n->'t') is distinct from 'string' then return false; end if;
        if (n->>'x')::numeric not between 0 and 1 or (n->>'y')::numeric not between 0 and 1 or char_length(btrim(n->>'t')) not between 1 and 80 then return false; end if;
      end loop;
    end if;
    if e ? 'marks' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'marks') <> 'array' or jsonb_array_length(e->'marks') > 8 then return false; end if;
      for n in select value from jsonb_array_elements(e->'marks') loop
        if jsonb_typeof(n) <> 'object' then return false; end if;
        if jsonb_typeof(n->'s') is distinct from 'number' or jsonb_typeof(n->'t') is distinct from 'string' then return false; end if;
        if (n->>'s')::numeric not between 0 and 3600 or char_length(btrim(n->>'t')) not between 1 and 60 then return false; end if;
      end loop;
    end if;
    if e ? 'cmp' then
      if jsonb_typeof(e->'cmp') <> 'boolean' then return false; end if;
      if (e->'cmp')::boolean then cmps := cmps + 1; end if;
    end if;
    if e->>'type' = 'image' then images := images + 1; else videos := videos + 1; end if;
  end loop;
  if videos > 0 and jsonb_array_length(m) <> 1 then return false; end if;
  if cmps > 0 and not (cmps = 2 and images = 2 and jsonb_array_length(m) = 2) then return false; end if;
  return true;
end
$$;

-- ---------- Profiles: photo and cover ----------
alter table public.profiles add column avatar_path text not null default '';
alter table public.profiles add column cover_path text not null default '';
alter table public.profiles add constraint profiles_media_paths check (public.media_path_ok(avatar_path, id) and public.media_path_ok(cover_path, id));
grant select (avatar_path, cover_path) on public.profiles to authenticated;
grant update (avatar_path, cover_path) on public.profiles to authenticated;

-- ---------- Posts: photos or a video ----------
alter table public.posts add column media jsonb not null default '[]'::jsonb;
alter table public.posts add constraint posts_media check (public.post_media_ok(media, author_id));
grant insert (media) on public.posts to authenticated;

-- ---------- Communities: cover image (uploaded by an admin, stored in their folder) ----------
alter table public.communities add column cover_path text not null default '';
alter table public.communities add constraint communities_cover_path check (cover_path = '' or (char_length(cover_path) <= 300 and cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'));
grant update (cover_path) on public.communities to authenticated;

revoke execute on function public.media_path_ok(text, uuid), public.post_media_ok(jsonb, uuid) from anon, public;
grant execute on function public.media_path_ok(text, uuid), public.post_media_ok(jsonb, uuid) to authenticated;
