import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/supabase/server";
import { viewableKind } from "@/lib/file-view";
import { kindOfFile } from "@/lib/project-file-types";

// A project file, streamed for viewing in the page (supabase/project-files-view-only.sql). Outside a
// project's team, documents and 3D models are view-only: Storage won't hand over the original, so the
// PDF reader and the 3D viewer get the bytes from here instead, after the database says this member
// can read the project. Only what the page itself fetches is served (not a tab opened on this address,
// which would show the browser's own PDF viewer with its download button), never cached, and never as
// something a browser would run.
const MAX_BYTES = 60 * 1024 * 1024;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not found.", { status: 404 });
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });

  const { data: access, error } = await supabase.rpc("project_file_access", { p_id: id });
  if (error || access === "none" || !access) return new Response("Not found.", { status: 404 });
  const { data: row } = await supabase.from("project_files").select("name, path, size").eq("id", id).maybeSingle();
  const file = row as { name: string; path: string | null; size: number | null } | null;
  if (!file?.path) return new Response("Not found.", { status: 404 });
  const kind = viewableKind(file.name);
  if (!kind) return new Response("This file can't be previewed.", { status: 415 });
  // Someone outside the team only gets what the page fetches for its viewer.
  const dest = req.headers.get("sec-fetch-dest");
  if (access !== "download" && dest && dest !== "empty") return new Response("Open this file on its project page.", { status: 403 });
  if ((file.size ?? 0) > MAX_BYTES) return new Response("This file is too big to preview.", { status: 413 });

  const admin = createAdminClient();
  if (!admin) return new Response("Previews aren't available right now.", { status: 503 });
  const { data: blob, error: dlError } = await admin.storage.from("project-files").download(file.path);
  if (dlError || !blob) return new Response("That file couldn't be opened.", { status: 502 });

  const type = kind === "pdf" ? "application/pdf" : kind === "text" ? "text/plain; charset=utf-8" : "application/octet-stream";
  const safeName = encodeURIComponent(file.name.replace(/[\r\n"]/g, ""));
  return new Response(blob.stream(), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(blob.size),
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-File-Kind": kindOfFile(file.name) ?? "",
    },
  });
}
