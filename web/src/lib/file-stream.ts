import { createAdminClient } from "@/lib/supabase/admin";
import { streamableKind } from "@/lib/file-view";

// Streams one stored file to the page for viewing (the routes under /api/project-files and
// /api/post-files). The caller has already asked the database whether this member may see it
// (`access`). Outside the people allowed the original, only what the page itself fetches is served:
// a tab opened on the address is refused, so the browser's own PDF viewer (with its download button)
// never shows. Never cached, never as something a browser would run. Videos answer range requests so
// they can play and seek.
const MAX_BYTES = 60 * 1024 * 1024;

export async function streamStoredFile(req: Request, { bucket, path, name, size, access }: { bucket: string; path: string; name: string; size: number | null; access: "view" | "download" }): Promise<Response> {
  const kind = streamableKind(name);
  if (!kind) return new Response("This file can't be previewed.", { status: 415 });
  const dest = req.headers.get("sec-fetch-dest");
  const embedded = kind === "image" ? dest === "image" || dest === "empty" : kind === "video" ? dest === "video" || dest === "empty" : dest === "empty";
  if (access !== "download" && dest && !embedded) return new Response("Open this file on its post.", { status: 403 });
  if (kind !== "video" && (size ?? 0) > MAX_BYTES) return new Response("This file is too big to preview.", { status: 413 });

  const admin = createAdminClient();
  if (!admin) return new Response("Previews aren't available right now.", { status: 503 });
  const { data: blob, error } = await admin.storage.from(bucket).download(path);
  if (error || !blob) return new Response("That file couldn't be opened.", { status: 502 });

  const type = kind === "pdf" ? "application/pdf" : kind === "text" ? "text/plain; charset=utf-8" : kind === "image" || kind === "video" ? blob.type || "application/octet-stream" : "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name.replace(/[\r\n"]/g, ""))}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Accept-Ranges": kind === "video" ? "bytes" : "none",
  };
  const range = kind === "video" ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "") : null;
  if (range) {
    const total = blob.size;
    const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2] || 0));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    if (!(start <= end && start < total)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    const part = blob.slice(start, end + 1);
    return new Response(part.stream(), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(part.size) } });
  }
  return new Response(blob.stream(), { headers: { ...headers, "Content-Length": String(blob.size) } });
}
