import { kindOfFile } from "@/lib/project-file-types";

// What a file on a post opens as when someone views it on the page (supabase/project-files-view-only.sql,
// supabase/post-files.sql): a PDF in the reader, plain text or code as text, a 3D model in the viewer.
// Office files, CAD and ZIPs have no in-page preview. Plain functions, so the server routes, the page
// and tests share them.
export type ViewKind = "pdf" | "text" | "model";

export function viewableKind(name: string): ViewKind | null {
  const k = kindOfFile(name);
  if (k === "pdf") return "pdf";
  if (k === "model") return "model";
  if (k === "text" || k === "code" || (k === "sheet" && /\.csv$/i.test(name))) return "text";
  return null;
}

// What the viewing routes stream: the readable kinds, plus pictures and videos (shown in the page).
export function streamableKind(name: string): ViewKind | "image" | "video" | null {
  const k = kindOfFile(name);
  return k === "image" || k === "video" ? k : viewableKind(name);
}

// Files on a project update live with the project (project_files); files on any other post live with
// the post (post_files). Each has its own viewing route.
export type FileSource = "project" | "post";

// Where the page fetches a file for viewing.
export const viewUrl = (id: number, source: FileSource = "project") => `/api/${source}-files/${id}`;

// Text previews stop here, so a huge log doesn't freeze the page.
export const TEXT_PREVIEW_CHARS = 200_000;
