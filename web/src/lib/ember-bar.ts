import type { Proposal } from "@/lib/copilot-agent";

// The Ask Ember bar at the top of every signed-in page (components/ember/ask-bar.tsx): which page it's
// on, when "/" may jump to it, and what an approve card's buttons say there. Pure, so the browser, the
// server and tests share it (tests/ember-bar.test.ts).

export const ASK_PLACEHOLDER = "Ask Ember, or tell it what you did…";

export type PageKind = "project" | "club" | "event";
export type PageRef = { kind: PageKind; id: string };

/** Ids as they appear in a path: anything else (spaces, encoded characters, too long) is no page. */
export const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const ROOTS: Record<string, PageKind> = { projects: "project", c: "club", events: "event" };

/**
 * The project, club or event a path is about, so Ember can act on it ("I got the PID loop stable" on a
 * project page drafts into that project). Only the id leaves the browser; the server looks the title up
 * as the member, so an id they can't read tells Ember nothing.
 */
export function pageContext(path: string): PageRef | null {
  const [root, id] = path.replace(/[?#].*$/, "").split("/").filter(Boolean);
  const kind = root ? ROOTS[root] : undefined;
  if (!kind || !id || !PAGE_ID.test(id)) return null;
  // Not a page about one thing: /projects/new, /events/new.
  if (id === "new") return null;
  return { kind, id };
}

type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; target: { tagName?: string; isContentEditable?: boolean } | null };

/** "/" jumps to the bar, unless the member is typing somewhere (then it's just a slash). */
export function askShortcut(e: KeyLike): boolean {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return false;
  const t = e.target;
  if (!t) return true;
  return !t.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? "");
}

/**
 * What a card's buttons say. In the page under the bar a card is short (Edit opens its fields) and its
 * buttons say what happens; on Ember's page and /drafts it stays as it was.
 */
export function cardLabels(kind: string, inline: boolean): { confirm: string; edit: string | null; dismiss: string } {
  if (!inline) return { confirm: "Confirm", edit: null, dismiss: "Dismiss" };
  return { confirm: kind === "milestone" ? "Log and send to club" : "Confirm", edit: "Edit", dismiss: "Not now" };
}

/**
 * A card in the page, before Edit: what it will do in a line or two, so the page doesn't fill with form
 * fields. null for kinds that are already short (join, follow, RSVP, teammate, review): they show as
 * they always have.
 */
export function cardSummary(p: Proposal): { title: string; lines: string[]; link: string } | null {
  const cut = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  switch (p.kind) {
    case "milestone": return { title: p.title, lines: [`On ${p.project_title}, for ${p.club_name} to sign`, ...(p.detail ? [cut(p.detail)] : [])], link: p.evidence };
    case "post": return { title: cut(p.body), lines: p.tags.length ? [p.tags.map((t) => `#${t}`).join(" ")] : [], link: "" };
    case "club_post": return { title: cut(p.body), lines: [`In ${p.club_name}. Only the club sees it.`], link: "" };
    case "project": return { title: p.title, lines: p.summary ? [cut(p.summary)] : [], link: p.link };
    case "message": return { title: cut(p.body), lines: [`To ${p.name}`], link: "" };
    case "event": return { title: p.title, lines: [`For ${p.club_name}${p.location ? ` · ${p.location}` : ""}`], link: "" };
    case "project_edit": return { title: `Update ${p.project_title}`, lines: [["summary", "details", "link", "specs"].filter((k) => p[k as keyof typeof p] !== undefined).map((k) => (k === "details" ? "write-up" : k)).join(", ")], link: "" };
    default: return null;
  }
}
