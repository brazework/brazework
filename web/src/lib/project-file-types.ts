// What a project's files folder accepts and how each kind shows (supabase/project-files.sql keeps the
// same extension list; the database is the gate, this is for clear messages and the right preview).

export const PROJECT_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const PROJECT_FILES_MAX = 100;

export type FileKind = "image" | "video" | "model" | "pdf" | "doc" | "sheet" | "slides" | "cad" | "code" | "archive" | "text";

const KINDS: Record<FileKind, string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "gif", "heic"],
  video: ["mp4", "webm", "mov"],
  model: ["stl", "obj", "glb", "gltf", "3mf"],
  pdf: ["pdf"],
  doc: ["doc", "docx", "odt", "rtf"],
  sheet: ["xls", "xlsx", "ods", "csv"],
  slides: ["ppt", "pptx", "odp"],
  cad: ["step", "stp", "iges", "igs", "f3d", "sldprt", "sldasm", "dxf", "dwg", "kicad_pcb", "kicad_sch", "brd", "sch", "gbr"],
  code: ["ino", "py", "ipynb", "c", "cpp", "h", "hpp", "m", "rs", "js", "ts", "java", "json"],
  archive: ["zip"],
  text: ["txt", "md"],
};
const BY_EXT = new Map(Object.entries(KINDS).flatMap(([k, exts]) => exts.map((e) => [e, k as FileKind])));
export const ACCEPTED_EXTS = [...BY_EXT.keys()];
// For the file picker's accept attribute.
export const ACCEPT_ATTR = ACCEPTED_EXTS.map((e) => `.${e}`).join(",");

export const extOf = (name: string) => (name.match(/\.([A-Za-z0-9_]{1,10})$/)?.[1] ?? "").toLowerCase();
export const kindOfFile = (name: string): FileKind | null => BY_EXT.get(extOf(name)) ?? null;

// The type a file is stored with. Only photos, videos, PDFs and plain text keep a type a browser
// would display; everything else downloads as bytes, so nothing uploaded can run as a web page.
export function storedType(name: string): string {
  const ext = extOf(name);
  const known: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf", txt: "text/plain", md: "text/plain", csv: "text/plain",
  };
  return known[ext] ?? "application/octet-stream";
}

export function sizeLabel(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// "github.com/owner/repo/..." → "owner/repo"; null for anything else.
export function githubRepo(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    return owner && repo ? `${owner}/${repo.replace(/\.git$/, "")}` : null;
  } catch {
    return null;
  }
}

// A pasted or typed link, made into an https URL (or null if it isn't one).
export function cleanUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || /\s/.test(t) || t.length > 500) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(t) ? `https://${t}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
