// Checking a proof link as it's added (Linear FIX-235): its real title, and whether it looks closed to
// the person who'll sign. Only a few known hosts are ever asked, by exact name, over https, with no
// redirects followed, so a member can't point the server at anything else. A check that can't tell
// says nothing: it warns, it never blocks. The fetch is in lib/proof-check-action.ts; these rules are
// pure and tested (tests/proof-check.test.ts).

export type ProofCheck = { title?: string; closed?: boolean };
export type CheckPlan = { url: string; kind: "oembed" | "page" };

const OEMBED: Record<string, (u: string) => string> = {
  "youtube.com": (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  "youtu.be": (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  "vimeo.com": (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  "loom.com": (u) => `https://www.loom.com/v1/oembed?url=${encodeURIComponent(u)}`,
};
// Pages whose answer to a stranger tells us something: a title when open, a sign-in or a 404 when not.
const PAGES = new Set(["docs.google.com", "drive.google.com", "github.com", "arxiv.org"]);

/** What to ask, or null to ask nothing. */
export function checkPlan(raw: string): CheckPlan | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if (OEMBED[host]) return { url: OEMBED[host](u.toString()), kind: "oembed" };
  if (PAGES.has(host)) {
    // Only the address itself, rebuilt on the known host: nothing a member typed decides where it goes.
    const safe = new URL(u.pathname + u.search, `https://${host === "github.com" || host === "arxiv.org" ? host : u.hostname.toLowerCase()}`);
    return { url: safe.toString(), kind: "page" };
  }
  return null;
}

const SIGN_IN = /^https:\/\/(accounts\.google\.com|github\.com\/login|www\.google\.com\/accounts)/i;

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** A page's title without the tool's own name around it. */
export function cleanTitle(raw: string): string {
  const t = decode(raw).replace(/\s+/g, " ").trim()
    .replace(/\s+[-–]\s+Google (Docs|Sheets|Slides|Drive|Forms)$/i, "")
    .replace(/^GitHub\s+-\s+/i, "")
    .replace(/\s+·\s+(GitHub|Pull Request #\d+ · [^·]+)$/i, "")
    .replace(/^\[[\d.v]+\]\s+/, "");
  if (!t || /^(Google (Docs|Drive|Sheets|Slides)|Sign in|GitHub|Page not found)/i.test(t)) return "";
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

/** What an answer means. `location` is the redirect target, if any; `body` the first part of the page. */
export function readAnswer(kind: CheckPlan["kind"], status: number, location: string | null, body: string): ProofCheck {
  if (status === 401 || status === 403 || status === 404) return { closed: true };
  if (status >= 300 && status < 400) return location && SIGN_IN.test(location) ? { closed: true } : {};
  if (status !== 200) return {};
  if (kind === "oembed") {
    try { const j = JSON.parse(body) as { title?: unknown }; return typeof j.title === "string" && cleanTitle(j.title) ? { title: cleanTitle(j.title) } : {}; } catch { return {}; }
  }
  // A Google sign-in page served in place (no redirect) is closed too.
  if (/<form[^>]+accounts\.google\.com|ServiceLogin/i.test(body)) return { closed: true };
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(body)?.[1];
  const title = cleanTitle(og ?? /<title[^>]*>([^<]{1,300})<\/title>/i.exec(body)?.[1] ?? "");
  return title ? { title } : {};
}
