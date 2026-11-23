import { streamStoredFile } from "@/lib/file-stream";
import { getViewer } from "@/lib/supabase/server";

// A project file, streamed for viewing in the page (supabase/project-files-view-only.sql). Outside a
// project's team, documents and 3D models are view-only: Storage won't hand over the original, so the
// PDF reader, the 3D viewer and the feed's pictures get the bytes from here instead, after the
// database says this member can read the project (lib/file-stream.ts does the rest).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not found.", { status: 404 });
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });

  const { data: access, error } = await supabase.rpc("project_file_access", { p_id: id });
  if (error || (access !== "view" && access !== "download")) return new Response("Not found.", { status: 404 });
  const { data: row } = await supabase.from("project_files").select("name, path, size").eq("id", id).maybeSingle();
  const file = row as { name: string; path: string | null; size: number | null } | null;
  if (!file?.path) return new Response("Not found.", { status: 404 });
  return streamStoredFile(req, { bucket: "project-files", path: file.path, name: file.name, size: file.size, access });
}
