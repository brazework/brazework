"use client";
import { getBrowserClient } from "@/lib/supabase/client";
import { StorageUploadError, storageUpload } from "@/lib/storage-upload";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, VIDEO_MAX_BYTES, VIDEO_TYPES, type MediaItem } from "@/lib/media";

// Uploads straight from the browser to Storage (row-level security only allows your own folder).
// Photos are shrunk and converted to WebP first: faster on phones, much smaller files, and it strips
// the original's location metadata. GIFs are kept as they are so they still animate.

export class UploadError extends Error {}

// A tiny blurred stand-in (Linear FIX-77): the picture at 16 px, as a data: URI saved with the post
// (a few hundred bytes), so the card has the photo's colours and shape before the photo arrives.
// WebP where the browser can write it, PNG otherwise (Safari); supabase/feed-pages.sql allows both.
function tiny(src: CanvasImageSource, w: number, h: number): string | undefined {
  if (!w || !h) return undefined;
  const s = 16 / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  try { c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height); } catch { return undefined; }
  const webp = c.toDataURL("image/webp", 0.5);
  const url = webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
  return url.length <= 1500 ? url : undefined;
}

async function shrink(file: File, maxSide: number): Promise<{ blob: Blob; w: number; h: number; ext: string; type: string; lq?: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  if (file.type === "image/gif") { const lq = tiny(bitmap, bitmap.width, bitmap.height); bitmap.close(); return { blob: file, w, h, ext: "gif", type: file.type, lq }; }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.86));
  if (!blob) throw new UploadError("That photo couldn't be processed. Try a JPEG or PNG.");
  return { blob, w, h, ext: "webp", type: "image/webp", lq: tiny(canvas, w, h) };
}

// A video's size and a poster frame (a WebP of an early frame, at most 960 px), read in the browser so
// feeds can show the poster without downloading the video (FIX-10). No poster if the browser can't
// decode the file; the player then shows a quiet cover instead.
function videoInfo(file: File): Promise<{ w: number; h: number; poster: Blob | null; lq?: string }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (r: { w: number; h: number; poster: Blob | null; lq?: string }) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(r); };
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) return finish({ w, h, poster: null });
      const scale = Math.min(1, 960 / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      try { c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height); } catch { return finish({ w, h, poster: null }); }
      const lq = tiny(c, c.width, c.height);
      c.toBlob((b) => finish({ w, h, poster: b, lq }), "image/webp", 0.8);
    };
    v.onerror = () => finish({ w: 0, h: 0, poster: null });
    setTimeout(() => finish({ w: v.videoWidth || 0, h: v.videoHeight || 0, poster: null }), 8000);
    v.src = url;
  });
}

export function kindOf(file: File): "image" | "video" | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

export async function uploadMedia(file: File, ownerId: string, opts: { maxSide?: number; onProgress?: (fraction: number) => void } = {}): Promise<MediaItem> {
  const kind = kindOf(file);
  if (!kind) throw new UploadError("Use a JPEG, PNG, WebP or GIF photo, or an MP4, WebM or MOV video.");
  if (kind === "image" && file.size > IMAGE_MAX_BYTES) throw new UploadError("Photos can be up to 20 MB.");
  if (kind === "video" && file.size > VIDEO_MAX_BYTES) throw new UploadError("Videos can be up to 250 MB. Trim it or export at a lower resolution.");

  const sb = getBrowserClient();
  const id = crypto.randomUUID();
  if (kind === "image") {
    const img = await shrink(file, opts.maxSide ?? 2000);
    const path = `${ownerId}/${id}.${img.ext}`;
    const { error } = await sb.storage.from("media").upload(path, img.blob, { contentType: img.type, cacheControl: "31536000", upsert: false });
    if (error) throw new UploadError(error.message || "Upload failed. Try again.");
    return { type: "image", path, w: img.w, h: img.h, bytes: img.blob.size, ...(img.lq && { lq: img.lq }) };
  }
  const { w, h, poster, lq } = await videoInfo(file);
  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const path = `${ownerId}/${id}.${ext}`;
  // Big videos go up resumably in 6 MB pieces, with progress (lib/storage-upload.ts).
  try { await storageUpload({ bucket: "media", path, file, contentType: file.type, onProgress: opts.onProgress }); }
  catch (e) { throw new UploadError(e instanceof StorageUploadError ? e.message : "Upload failed. Try again."); }
  let posterPath: string | undefined;
  if (poster) {
    const p = `${ownerId}/${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from("media").upload(p, poster, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (!error) posterPath = p; // a missing poster only means the quiet cover shows instead
  }
  return { type: "video", path, w: w || undefined, h: h || undefined, bytes: file.size, ...(posterPath && { poster: posterPath }), ...(lq && { lq }) };
}

// Best effort: tidy up a file someone removed before posting.
export async function removeUploaded(path: string) {
  try { await getBrowserClient().storage.from("media").remove([path]); } catch {}
}
