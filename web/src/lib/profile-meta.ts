// Profile extras (supabase/profile-extras.sql): what someone is open to, their links, where they are.

export const OPEN_TO = [
  { id: "internships", label: "Internships" },
  { id: "full_time", label: "Full-time roles" },
  { id: "research", label: "Research" },
  { id: "co_founder", label: "Co-founding" },
  { id: "collaborators", label: "Collaborators" },
  { id: "mentoring", label: "Mentoring" },
] as const;
export type OpenTo = (typeof OPEN_TO)[number]["id"];
export const openToLabel = (id: string) => OPEN_TO.find((o) => o.id === id)?.label ?? id;

export type ProfileLink = { label?: string; url: string };

// Only https links, at most five, each with an optional short label (the database checks again).
export function cleanLinks(raw: unknown): ProfileLink[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ProfileLink[] = [];
  for (const l of raw) {
    const url = typeof l?.url === "string" ? l.url.trim() : "";
    const label = typeof l?.label === "string" ? l.label.replace(/[<>]/g, "").trim().slice(0, 40) : "";
    if (!url) continue;
    if (!/^https:\/\/[^\s<>"]+$/.test(url) || url.length > 300) return null;
    out.push(label ? { label, url } : { url });
  }
  return out.length <= 5 ? out : null;
}

// What a link is called when it has no label: the site, without "www." ("github.com/jm").
export function linkName(l: ProfileLink) {
  if (l.label) return l.label;
  try {
    const u = new URL(l.url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return path && path.length < 24 ? `${host}${path}` : host;
  } catch { return l.url; }
}

// Graduation year (supabase/grad-year.sql): optional. The choices run from ten years back (recent
// alumni) to six ahead (an incoming first-year), counted from this year.
export function gradYearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  return Array.from({ length: 17 }, (_, i) => y + 6 - i);
}

// "" clears it; anything else must be a whole year the database accepts (it checks again).
export function parseGradYear(raw: FormDataEntryValue | null): { ok: true; value: number | null } | { ok: false } {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d{4}$/.test(s)) return { ok: false };
  const n = Number(s);
  return n >= 1960 && n <= 2045 ? { ok: true, value: n } : { ok: false };
}

export const classOf = (year: number | null | undefined) => (year ? `Class of ${year}` : "");
