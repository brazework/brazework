import { kindOfFile } from "@/lib/project-file-types";

// What a project file opens as when someone views it on the page (supabase/project-files-view-only.sql):
// a PDF in the reader, plain text or code as text, a 3D model in the viewer. Office files, CAD and ZIPs
// have no in-page preview; only the project's builders can download those. Plain functions, so the
// server route, the page and tests share them.
export type ViewKind = "pdf" | "text" | "model";

export function viewableKind(name: string): ViewKind | null {
  const k = kindOfFile(name);
  if (k === "pdf") return "pdf";
  if (k === "model") return "model";
  if (k === "text" || k === "code" || (k === "sheet" && /\.csv$/i.test(name))) return "text";
  return null;
}

// Where the page fetches a file for viewing.
export const viewUrl = (id: number) => `/api/project-files/${id}`;

// Text previews stop here, so a huge log doesn't freeze the page.
export const TEXT_PREVIEW_CHARS = 200_000;
