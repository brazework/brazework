-- Step 36: captions and transcripts on videos (Linear FIX-51). Photos already carry a description
-- for screen readers; videos can now carry captions (a WebVTT file, shown on the video) and a
-- transcript (shown under it). Redefines post_media_ok() from media.sql with two more keys, cc and
-- tx, on videos only; every other rule is unchanged. Additive and safe to re-run.

create or replace function public.post_media_ok(m jsonb, owner uuid) returns boolean
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
    if exists (select 1 from jsonb_object_keys(e) k where k not in ('type', 'path', 'w', 'h', 'alt', 'notes', 'marks', 'cmp', 'cc', 'tx')) then return false; end if;
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
    -- Captions (WebVTT text) and a transcript, on videos only (step 36).
    if e ? 'cc' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'cc') <> 'string' or char_length(e->>'cc') > 20000
         or left(e->>'cc', 6) <> 'WEBVTT' or position('-->' in (e->>'cc')) = 0 then return false; end if;
    end if;
    if e ? 'tx' then
      if e->>'type' <> 'video' or jsonb_typeof(e->'tx') <> 'string' or char_length(btrim(e->>'tx')) not between 1 and 5000 then return false; end if;
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

-- Lets the app know this step has run (web/src/lib/db-features.ts).
create or replace function public.video_captions_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.video_captions_ready() to authenticated;
