import { streamStoredFile } from "@/lib/file-stream";
import { getViewer } from "@/lib/supabase/server";

// A file on a post (supabase/post-files.sql), streamed for viewing in the page: the 3D viewer, the PDF
// reader, pictures and videos. Storage only gives the original to whoever uploaded it; everyone who can
// see the post gets the bytes from here, never a link to the file (lib/file-stream.ts).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not found.", { status: 404 });
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });

  const { data: access, error } = await supabase.rpc("post_file_access", { p_id: id });
  if (error || access !== "view") return new Response("Not found.", { status: 404 });
  const { data: row } = await supabase.from("post_files").select("name, path, size").eq("id", id).maybeSingle();
  const file = row as { name: string; path: string | null; size: number | null } | null;
  if (!file?.path) return new Response("Not found.", { status: 404 });
  return streamStoredFile(req, { bucket: "post-files", path: file.path, name: file.name, size: file.size, access: "view" });
}
