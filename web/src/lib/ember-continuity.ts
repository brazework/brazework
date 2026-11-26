// Jig picks up where you left off (Linear FIX-233): what a member has talked to Jig about lately,
// from the chats Jig already saves for them (supabase/copilot-chats.sql). Nothing new is stored:
// these are the chats the member sees in "Your chats" and can delete. Pure, so it's tested
// (tests/ember-continuity.test.ts).
import type { NextStep } from "@/lib/ember-record";

export type RecentChat = { id: string; title: string; updated_at: string };

const DAY = 864e5;
/** A chat this recent is offered as "pick up where you left off". */
export const CONTINUE_DAYS = 3;
const LISTED = 5;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const ago = (ms: number) => { const d = Math.floor(ms / DAY); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

/** For Jig's instructions: their recent chats, newest first, so it can refer back to them. */
export function recentChatLines(chats: RecentChat[], now: number): string[] {
  const recent = chats.filter((c) => c.title.trim()).slice(0, LISTED);
  if (!recent.length) return [];
  const each = recent.map((c) => `"${cut(c.title.trim(), 90)}" (${ago(now - Date.parse(c.updated_at))})`);
  return [`Their recent chats with you, newest first: ${each.join("; ")}. These are only their titles: refer back to them when it helps ("last time you were planning …") and build on them, but don't claim to remember details you can't see, and don't repeat old answers.`];
}

/** The newest chat, if it was in the last few days: the first thing a new chat can offer. */
export function continueStep(chats: RecentChat[], now: number): NextStep | null {
  const last = chats.find((c) => c.title.trim());
  if (!last || now - Date.parse(last.updated_at) > CONTINUE_DAYS * DAY) return null;
  return { id: "continue", label: `Pick up where you left off: ${cut(last.title.trim(), 60)}`, hint: `Your last chat with Jig, ${ago(now - Date.parse(last.updated_at))}.`, href: `/copilot?chat=${last.id}` };
}
