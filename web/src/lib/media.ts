import { env } from "@/lib/env";
import { TRANSCRIPT_MAX, toVtt } from "@/lib/captions";

// Photos and video (supabase/media.sql). Rows store a path inside the public "media" bucket,
// always "<owner id>/<file>"; this turns it into a URL.
export type Callout = { x: number; y: number; t: string };
export type Marker = { s: number; t: string };
/**
 * One photo or video on a post. Beyond the file itself:
 * - alt: a description for screen readers (photos)
 * - notes: numbered callouts pinned on a photo, x/y as fractions of its size
 * - marks: labelled moments on a video (seconds), shown on its timeline
 * - cmp: set on both photos of a 2-photo post to show them as a before/after slider
 * - cc: captions (WebVTT text) shown on a video; tx: a transcript shown under it (video-captions.sql)
 */
export type MediaItem = { type: "image" | "video"; path: string; w?: number; h?: number; bytes?: number; alt?: string; notes?: Callout[]; marks?: Marker[]; cmp?: boolean; cc?: string; tx?: string };

export const MAX_CALLOUTS = 6;
export const MAX_MARKERS = 8;
const KEYS = new Set(["type", "path", "w", "h", "bytes", "alt", "notes", "marks", "cmp", "cc", "tx"]);

// Videos play by themselves only up to this size (the file's size, saved at upload). Bigger ones, and
// older ones uploaded before sizes were saved, wait for a tap: autoplay downloads the whole file for
// everyone who scrolls past it, which is most of our Storage bandwidth (Linear FIX-75).
export const AUTOPLAY_MAX_BYTES = 8 * 1024 * 1024;
export const autoplays = (m: MediaItem) => m.type === "video" && typeof m.bytes === "number" && m.bytes <= AUTOPLAY_MAX_BYTES;

export const MAX_IMAGES = 4;
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024; // before we shrink it in the browser
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // the bucket's own limit
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const mediaUrl = (path: string) => `${env.supabaseUrl}/storage/v1/object/public/media/${path.split("/").map(encodeURIComponent).join("/")}`;

const PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i;

// Same rules as post_media_ok() in media.sql, checked on the server before the database sees it.
// Returns a clean copy (trimmed text, rounded numbers) or null if anything is off.
export function validMedia(value: unknown, ownerId: string): MediaItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) return null;
  const out: MediaItem[] = [];
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null);
  const frac = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  for (const v of value) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (Object.keys(o).some((k) => !KEYS.has(k))) return null;
    const { type, path, w, h } = o;
    if ((type !== "image" && type !== "video") || typeof path !== "string" || !PATH_RE.test(path) || !path.startsWith(`${ownerId}/`)) return null;
    const dim = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 && n < 20000 ? Math.round(n) : undefined);
    const item: MediaItem = { type, path, w: dim(w), h: dim(h) };
    if (o.bytes !== undefined) {
      if (typeof o.bytes !== "number" || !Number.isInteger(o.bytes) || o.bytes <= 0 || o.bytes > 52428800) return null;
      item.bytes = o.bytes;
    }
    if (o.alt !== undefined && o.alt !== "") {
      const alt = text(o.alt, 200);
      if (alt === null) return null;
      item.alt = alt;
    }
    if (o.notes !== undefined) {
      if (type !== "image" || !Array.isArray(o.notes) || o.notes.length > MAX_CALLOUTS) return null;
      const notes: Callout[] = [];
      for (const n of o.notes) {
        const c = n as Record<string, unknown>;
        const t = c && typeof c === "object" ? text(c.t, 80) : null;
        if (!t || !frac(c.x) || !frac(c.y)) return null;
        notes.push({ x: Math.round((c.x as number) * 1000) / 1000, y: Math.round((c.y as number) * 1000) / 1000, t });
      }
      if (notes.length) item.notes = notes;
    }
    if (o.marks !== undefined) {
      if (type !== "video" || !Array.isArray(o.marks) || o.marks.length > MAX_MARKERS) return null;
      const marks: Marker[] = [];
      for (const n of o.marks) {
        const m = n as Record<string, unknown>;
        const t = m && typeof m === "object" ? text(m.t, 60) : null;
        if (!t || typeof m.s !== "number" || !Number.isFinite(m.s) || m.s < 0 || m.s > 3600) return null;
        marks.push({ s: Math.round(m.s * 10) / 10, t });
      }
      if (marks.length) item.marks = marks.sort((a, b) => a.s - b.s);
    }
    // Captions (WebVTT, from a .vtt or .srt file) and a transcript, on videos only (video-captions.sql).
    if (o.cc !== undefined && o.cc !== "") {
      const cc = type === "video" ? toVtt(o.cc) : null;
      if (!cc) return null;
      item.cc = cc;
    }
    if (o.tx !== undefined && o.tx !== "") {
      const tx = type === "video" ? text(o.tx, TRANSCRIPT_MAX) : null;
      if (!tx) return null;
      item.tx = tx;
    }
    if (o.cmp !== undefined) {
      if (typeof o.cmp !== "boolean") return null;
      if (o.cmp) item.cmp = true;
    }
    out.push(item);
  }
  if (out.some((m) => m.type === "video") && out.length > 1) return null;
  // Before/after needs exactly two photos, both marked.
  if (out.some((m) => m.cmp) && !(out.length === 2 && out.every((m) => m.type === "image" && m.cmp))) return null;
  return out;
}

// A profile's photo URL, if it has one (avatar_path exists once media.sql has run).
export const avatarSrc = (p: { avatar_path?: string | null } | null | undefined) => (p?.avatar_path ? mediaUrl(p.avatar_path) : null);
