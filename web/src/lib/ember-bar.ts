import type { Proposal } from "@/lib/copilot-agent";
import { MAX_TURN, type CardOutcome, type ThreadTurn } from "@/lib/ember-thread";

// The Ask Torch bar at the top of every signed-in page (components/ember/ask-bar.tsx): which page it's
// on, when "/" may jump to it, and what an approve card's buttons say there. Pure, so the browser, the
// server and tests share it (tests/ember-bar.test.ts).

export const ASK_PLACEHOLDER = "Ask Torch, or tell it what you did…";

export type PageKind = "project" | "club" | "event";
export type PageRef = { kind: PageKind; id: string };

/** Ids as they appear in a path: anything else (spaces, encoded characters, too long) is no page. */
export const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const ROOTS: Record<string, PageKind> = { projects: "project", c: "club", events: "event" };

/**
 * The project, club or event a path is about, so Torch can act on it ("I got the PID loop stable" on a
 * project page drafts into that project). Only the id leaves the browser; the server looks the title up
 * as the member, so an id they can't read tells Torch nothing.
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
 * buttons say what happens; on Torch's page and /drafts it stays as it was.
 */
export function cardLabels(kind: string, inline: boolean): { confirm: string; edit: string | null; dismiss: string } {
  // Asking a person to sign sends an email, so its button says so everywhere.
  if (!inline) return { confirm: kind === "signature" ? "Ask them to sign" : kind === "goal" ? "Set this goal" : kind === "memory" ? "Remember this" : "Confirm", edit: null, dismiss: "Dismiss" };
  return { confirm: kind === "milestone" ? "Log and send to club" : kind === "signature" ? "Ask them to sign" : kind === "goal" ? "Set this goal" : kind === "memory" ? "Remember this" : "Confirm", edit: "Edit", dismiss: "Not now" };
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
    // With no address yet the card opens with its fields, so the member can type one.
    case "signature": return p.email ? { title: p.title, lines: [`On ${p.project_title}, for ${p.email} to sign`, ...(p.detail ? [cut(p.detail)] : [])], link: p.evidence } : null;
    case "post": return { title: cut(p.body), lines: p.tags.length ? [p.tags.map((t) => `#${t}`).join(" ")] : [], link: "" };
    case "club_post": return { title: cut(p.body), lines: [`In ${p.club_name}. Only the club sees it.`], link: "" };
    case "project": return { title: p.title, lines: p.summary ? [cut(p.summary)] : [], link: p.link };
    case "message": return { title: cut(p.body), lines: [`To ${p.name}`], link: "" };
    case "event": return { title: p.title, lines: [`For ${p.club_name}${p.location ? ` · ${p.location}` : ""}`], link: "" };
    case "memory": return { title: `Remember: ${cut(p.body, 120)}`, lines: ["Carries over to your next chats. Forget it any time in Settings."], link: "" };
    case "goal": return { title: `Work toward ${p.title}`, lines: p.why ? [cut(p.why)] : [], link: "" };
    case "project_edit": return { title: `Update ${p.project_title}`, lines: [["summary", "details", "link", "specs"].filter((k) => p[k as keyof typeof p] !== undefined).map((k) => (k === "details" ? "write-up" : k)).join(", ")], link: "" };
    case "quiz": return { title: p.title, lines: [`${p.questions.length} ${p.questions.length === 1 ? "question" : "questions"} · ${p.questions.reduce((t, q) => t + q.points, 0)} points · ${p.class_name}`, p.publish ? "Posts to the class when you confirm" : "Saved as a draft when you confirm"], link: "" };
    case "assignment": return { title: p.title, lines: [`${p.points} points${p.rubric.length ? ` · ${p.rubric.length}-row rubric` : ""} · ${p.class_name}`, p.publish ? "Posts to the class when you confirm" : "Saved as a draft when you confirm"], link: "" };
    case "announcement": return { title: p.title, lines: [cut(p.body), `To everyone in ${p.class_name}`], link: "" };
    case "extension": return { title: `Extend ${p.assignment_title} for ${p.name}`, lines: [`New due date: ${new Date(p.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`], link: "" };
    case "attendance": return { title: `Take attendance${p.title ? `: ${p.title}` : ""}`, lines: [`${p.class_name} · check-in open ${p.minutes} minutes`], link: "" };
    default: return null;
  }
}

// ---------- The bar keeps its thread ----------
// The bar used to send each question alone, so a follow-up tapped under an answer ("Draft the post")
// reached Torch with no idea what that answer said. It now sends the exchange it's showing, with what
// happened to each answer's cards (lib/ember-thread.ts).

/** The most turns the bar sends back: the request allows 12 messages, a question and an answer each. */
export const BAR_TURNS = 6;

/** One exchange in the bar: what the member said, Torch's words (follow-up marker removed), its cards. */
export type BarTurn = { q: string; text: string; cards: CardOutcome[] };

/**
 * The bar's exchange as history, oldest first. A turn with no answer (it failed, or was stopped before
 * a word came) is left out whole, so questions and answers still alternate.
 */
export function barHistory(turns: BarTurn[]): ThreadTurn[] {
  return turns.filter((t) => t.q.trim() && t.text.trim()).slice(-BAR_TURNS).flatMap((t): ThreadTurn[] => [
    { role: "user", content: t.q.slice(0, MAX_TURN) },
    { role: "assistant", content: t.text.slice(0, MAX_TURN), ...(t.cards.length ? { cards: t.cards } : {}) },
  ]);
}
