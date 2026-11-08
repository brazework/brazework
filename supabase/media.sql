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

-- Post media: [{ "type": "image" | "video", "path": "<uid>/<file>", "w": 1600, "h": 900 }],
-- up to 4 images, or exactly 1 video.
create function public.post_media_ok(m jsonb, owner uuid) returns boolean
language sql immutable as $$
  select jsonb_typeof(m) = 'array'
    and jsonb_array_length(m) <= 4
    and not exists (
      select 1 from jsonb_array_elements(m) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e->>'type', '') not in ('image', 'video')
         or not public.media_path_ok(coalesce(e->>'path', ''), owner)
         or coalesce(e->>'path', '') = '')
    and (not exists (select 1 from jsonb_array_elements(m) e where e->>'type' = 'video') or jsonb_array_length(m) = 1)
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
