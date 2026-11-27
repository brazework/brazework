// How much of a conversation Ember sees (Linear FIX-239). Ember used to see only the last 10
// messages, so it lost track of what a member said earlier in the same chat. Now it gets the whole
// conversation while it fits a budget. When a chat outgrows the budget, the start of the chat and the
// latest messages stay word for word, and the middle is folded into a short summary Ember writes
// (lib/ember-history-summary.ts), so nothing important drops out without a trace.
//
// The fold point moves in steps of FOLD_STEP messages, not one message at a time. Between steps the
// folded part (and its summary) stays the same, so the prompt's prefix stays byte-identical and the
// prompt cache keeps hitting; it only changes once every few turns. Pure, so it's unit-tested
// (tests/ember-history.test.ts) and shared by the server and the client.

export type Turn = { role: "user" | "assistant"; content: string };

// About 25,000 tokens of conversation (four characters a token, roughly). Well inside the model's
// context, and most chats never reach it.
export const HISTORY_CHAR_BUDGET = 100_000;
// The opening question and Ember's first answer: they usually say what the chat is about.
export const KEEP_HEAD = 2;
// Never fold the last few messages: a follow-up nearly always points at them.
export const KEEP_TAIL_MIN = 4;
export const FOLD_STEP = 10;
// What a stored chat or a request can hold (supabase/copilot-chats.sql keeps 80; each message is cut to 6,000).
export const MAX_TURNS = 80;
export const MAX_TURN_CHARS = 6000;

const size = (ts: Turn[]) => ts.reduce((n, t) => n + t.content.length, 0);

// What can be sent: non-empty turns, each cut to the per-message limit, the latest MAX_TURNS, and
// starting with the member (the API wants the first message to be theirs).
export function cleanTurns(ts: { role: string; content: unknown }[]): Turn[] {
  const out = ts.flatMap((t): Turn[] => ((t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim() ? [{ role: t.role, content: t.content.slice(0, MAX_TURN_CHARS) }] : [])).slice(-MAX_TURNS);
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export type HistoryPlan = { head: Turn[]; folded: Turn[]; tail: Turn[] };

// Split a conversation into what's sent as is (head, tail) and what's folded into a summary.
// Within budget, everything is in `head` and nothing is folded.
export function planHistory(turns: Turn[], budget = HISTORY_CHAR_BUDGET): HistoryPlan {
  if (size(turns) <= budget || turns.length <= KEEP_HEAD + KEEP_TAIL_MIN) return { head: turns, folded: [], tail: [] };
  const head = turns.slice(0, KEEP_HEAD);
  // Leave room for the summary itself (it's short: lib/ember-history-summary.ts asks for ~250 words).
  const room = budget - size(head) - 2_000;
  // The smallest fold that fits, then rounded up to the next step so it holds still for a while.
  let keep = 0, used = 0;
  for (let i = turns.length - 1; i >= KEEP_HEAD; i--) {
    if (used + turns[i].content.length > room && keep >= KEEP_TAIL_MIN) break;
    used += turns[i].content.length;
    keep++;
  }
  const need = turns.length - KEEP_HEAD - keep;
  let end = KEEP_HEAD + Math.ceil(need / FOLD_STEP) * FOLD_STEP;
  end = Math.min(end, turns.length - KEEP_TAIL_MIN);
  // The tail starts with the member's turn, so the summary (sent as theirs) joins it cleanly.
  if (turns[end]?.role !== "user") end = Math.max(KEEP_HEAD, end - 1);
  if (end <= KEEP_HEAD) return { head: turns, folded: [], tail: [] };
  return { head, folded: turns.slice(KEEP_HEAD, end), tail: turns.slice(end) };
}

// The note that stands in for the folded middle. With no summary (the summary call failed), it
// still says how much is missing, so Ember can ask rather than guess.
export function foldNote(folded: Turn[], summary: string): string {
  const n = folded.length;
  const what = `${n} earlier ${n === 1 ? "message" : "messages"} from the middle of this chat`;
  return summary.trim()
    ? `[${what}, summarised so the chat fits: ${summary.trim()}]`
    : `[${what} aren't shown here. If the member refers to something you can't see, ask them rather than guess.]`;
}

// The messages to send: head, the note for the folded part (as the member's turn, joined by the API
// with the tail's first message), then the tail.
export function historyMessages(plan: HistoryPlan, summary = ""): Turn[] {
  if (!plan.folded.length) return plan.head;
  return [...plan.head, { role: "user", content: foldNote(plan.folded, summary) }, ...plan.tail];
}

// The Ask Ember bar keeps a short conversation inside one open answer card: the turns so far, plus
// the answer on screen, become the history of a follow-up.
export function followUpHistory(earlier: Turn[], q: string, answer: string): Turn[] {
  return cleanTurns([...earlier, { role: "user", content: q }, { role: "assistant", content: answer }]);
}
