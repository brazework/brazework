// Where a link to someone's work lives (the project form's "Start from a link", 2026-11-26). Engineers
// keep work in many places: code on GitHub, CAD in Onshape or Fusion, papers and reports in Drive,
// tests on YouTube. GitHub links are imported (lib/projects import); every other kind fills the
// project's link and adds the tool, so the form isn't GitHub-only. Pure, and tested
// (tests/work-link.test.ts).

export type WorkSource = { id: string; label: string; tool?: string; kind: "code" | "cad" | "docs" | "video" | "design" | "data" | "other" };

const SOURCES: { test: RegExp; source: WorkSource }[] = [
  { test: /(^|\.)github\.com$/, source: { id: "github", label: "GitHub", kind: "code" } },
  { test: /(^|\.)gitlab\.com$/, source: { id: "gitlab", label: "GitLab", kind: "code" } },
  { test: /(^|\.)onshape\.com$/, source: { id: "onshape", label: "Onshape", tool: "Onshape", kind: "cad" } },
  { test: /(^|\.)(autodesk|a360|fusion360\.autodesk)\.com$|(^|\.)autodesk360\.com$/, source: { id: "fusion", label: "Fusion", tool: "Fusion 360", kind: "cad" } },
  { test: /(^|\.)grabcad\.com$/, source: { id: "grabcad", label: "GrabCAD", kind: "cad" } },
  { test: /(^|\.)(printables|thingiverse)\.com$/, source: { id: "printables", label: "3D model", tool: "3D printing", kind: "cad" } },
  { test: /(^|\.)(drive|docs)\.google\.com$/, source: { id: "drive", label: "Google Drive", kind: "docs" } },
  { test: /(^|\.)(overleaf\.com)$/, source: { id: "overleaf", label: "Overleaf", tool: "LaTeX", kind: "docs" } },
  { test: /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/, source: { id: "video", label: "Video", kind: "video" } },
  { test: /(^|\.)figma\.com$/, source: { id: "figma", label: "Figma", tool: "Figma", kind: "design" } },
  { test: /(^|\.)(kaggle\.com|huggingface\.co)$/, source: { id: "data", label: "Dataset or model", kind: "data" } },
  { test: /(^|\.)(wokwi\.com|tinkercad\.com|easyeda\.com|oshwlab\.com)$/, source: { id: "circuit", label: "Circuit", kind: "design" } },
];

/** What kind of link this is, or null when it isn't a web link. Unknown hosts are "other". */
export function workSource(url: string): WorkSource | null {
  let host = "";
  try { host = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`).hostname.toLowerCase(); } catch { return null; }
  if (!host.includes(".")) return null;
  return SOURCES.find((s) => s.test.test(host))?.source ?? { id: "other", label: host.replace(/^www\./, ""), kind: "other" };
}

/** The link as stored: https, no surrounding spaces. */
export function cleanLink(url: string): string {
  const t = url.trim();
  return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
}
