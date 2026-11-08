import { env } from "@/lib/env";

// Photos and video (supabase/media.sql). Rows store a path inside the public "media" bucket,
// always "<owner id>/<file>"; this turns it into a URL.
export type MediaItem = { type: "image" | "video"; path: string; w?: number; h?: number };

export const MAX_IMAGES = 4;
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024; // before we shrink it in the browser
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // the bucket's own limit
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const mediaUrl = (path: string) => `${env.supabaseUrl}/storage/v1/object/public/media/${path.split("/").map(encodeURIComponent).join("/")}`;

const PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i;

// Same rules as post_media_ok() in media.sql, checked on the server before the database sees it.
export function validMedia(value: unknown, ownerId: string): MediaItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) return null;
  const out: MediaItem[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") return null;
    const { type, path, w, h } = v as Record<string, unknown>;
    if ((type !== "image" && type !== "video") || typeof path !== "string" || !PATH_RE.test(path) || !path.startsWith(`${ownerId}/`)) return null;
    const dim = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 && n < 20000 ? Math.round(n) : undefined);
    out.push({ type, path, w: dim(w), h: dim(h) });
  }
  if (out.some((m) => m.type === "video") && out.length > 1) return null;
  return out;
}

// A profile's photo URL, if it has one (avatar_path exists once media.sql has run).
export const avatarSrc = (p: { avatar_path?: string | null } | null | undefined) => (p?.avatar_path ? mediaUrl(p.avatar_path) : null);
