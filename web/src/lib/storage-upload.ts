import { Upload } from "tus-js-client";
import { env } from "@/lib/env";
import { getBrowserClient } from "@/lib/supabase/client";

// One way to put a file in Storage from the browser (Linear FIX-10). Up to 6 MB: a normal upload.
// Bigger (phone videos, up to 250 MB): Supabase's resumable (TUS) upload, in 6 MB pieces, so a dropped
// connection picks up where it stopped instead of starting over, with progress along the way.
// Uploads never change (a new path each time) and are cached for a year.
export const RESUMABLE_ABOVE = 6 * 1024 * 1024;
const CHUNK = 6 * 1024 * 1024; // Supabase requires exactly 6 MB pieces.

export class StorageUploadError extends Error {}

// The resumable endpoint: hosted projects use the direct storage host (faster for big files); the
// local test stack serves it on the same origin.
export function resumableEndpoint(supabaseUrl: string): string {
  const u = new URL(supabaseUrl);
  const ref = u.hostname.endsWith(".supabase.co") ? u.hostname.split(".")[0] : null;
  return ref ? `${u.protocol}//${ref}.storage.supabase.co/storage/v1/upload/resumable` : `${u.origin}/storage/v1/upload/resumable`;
}

export async function storageUpload(opts: { bucket: string; path: string; file: Blob; contentType: string; onProgress?: (fraction: number) => void }): Promise<void> {
  const { bucket, path, file, contentType, onProgress } = opts;
  const sb = getBrowserClient();
  if (file.size <= RESUMABLE_ABOVE) {
    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType, cacheControl: "31536000", upsert: false });
    if (error) throw new StorageUploadError(error.message || "Upload failed. Try again.");
    onProgress?.(1);
    return;
  }
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StorageUploadError("Log in again to upload.");
  await new Promise<void>((resolve, reject) => {
    const up = new Upload(file, {
      endpoint: resumableEndpoint(env.supabaseUrl),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: "31536000" },
      chunkSize: CHUNK,
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onError: (e) => reject(new StorageUploadError(/413|maximum allowed size/i.test(String(e)) ? "That file is over the size limit." : "The upload stopped. Check your connection and try again.")),
      onSuccess: () => { onProgress?.(1); resolve(); },
    });
    // Picks up an earlier, interrupted upload of the same file if there is one.
    up.findPreviousUploads().then((prev) => { if (prev.length) up.resumeFromPreviousUpload(prev[0]); up.start(); }).catch(() => up.start());
  });
}
