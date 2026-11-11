"use client";
import { getBrowserClient } from "@/lib/supabase/client";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, VIDEO_MAX_BYTES, VIDEO_TYPES, type MediaItem } from "@/lib/media";

// Uploads straight from the browser to Storage (row-level security only allows your own folder).
// Photos are shrunk and converted to WebP first: faster on phones, much smaller files, and it strips
// the original's location metadata. GIFs are kept as they are so they still animate.

export class UploadError extends Error {}

async function shrink(file: File, maxSide: number): Promise<{ blob: Blob; w: number; h: number; ext: string; type: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  if (file.type === "image/gif") { bitmap.close(); return { blob: file, w, h, ext: "gif", type: file.type }; }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.86));
  if (!blob) throw new UploadError("That photo couldn't be processed. Try a JPEG or PNG.");
  return { blob, w, h, ext: "webp", type: "image/webp" };
}

function videoSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight }); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve({ w: 0, h: 0 });
    v.src = URL.createObjectURL(file);
  });
}

export function kindOf(file: File): "image" | "video" | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

export async function uploadMedia(file: File, ownerId: string, opts: { maxSide?: number } = {}): Promise<MediaItem> {
  const kind = kindOf(file);
  if (!kind) throw new UploadError("Use a JPEG, PNG, WebP or GIF photo, or an MP4, WebM or MOV video.");
  if (kind === "image" && file.size > IMAGE_MAX_BYTES) throw new UploadError("Photos can be up to 20 MB.");
  if (kind === "video" && file.size > VIDEO_MAX_BYTES) throw new UploadError("Videos can be up to 50 MB. Trim it or export at a lower resolution.");

  const sb = getBrowserClient();
  const id = crypto.randomUUID();
  if (kind === "image") {
    const img = await shrink(file, opts.maxSide ?? 2000);
    const path = `${ownerId}/${id}.${img.ext}`;
    const { error } = await sb.storage.from("media").upload(path, img.blob, { contentType: img.type, cacheControl: "31536000", upsert: false });
    if (error) throw new UploadError(error.message || "Upload failed. Try again.");
    return { type: "image", path, w: img.w, h: img.h, bytes: img.blob.size };
  }
  const { w, h } = await videoSize(file);
  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const path = `${ownerId}/${id}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new UploadError(error.message || "Upload failed. Try again.");
  return { type: "video", path, w: w || undefined, h: h || undefined, bytes: file.size };
}

// Best effort: tidy up a file someone removed before posting.
export async function removeUploaded(path: string) {
  try { await getBrowserClient().storage.from("media").remove([path]); } catch {}
}
