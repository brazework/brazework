// The feed, tuned to where you're headed (Linear FIX-231): on "For you", posts that match your goal's
// field come first on the first page, each labelled "Toward your goal". The same posts as before, only
// reordered, so the next pages (asked for by where page one ended) are unchanged. Pure, so it's
// tested (tests/feed-goal.test.ts).
import { GOAL_KINDS, type GoalKind } from "@/lib/goals";

// Words that say a post is about getting there, for each kind of goal.
const KIND_WORDS: Record<GoalKind, string[]> = {
  internship: ["internship", "intern"],
  job: ["hiring", "job", "role", "career"],
  grad: ["grad school", "phd", "masters", "research"],
  research: ["research", "lab", "paper"],
  competition: ["competition", "hackathon", "challenge"],
  funding: ["funding", "grant", "pitch", "investor"],
};

/** The words a post is matched on: the goal's field (its target) and its kind. */
export function goalWords(goal: { kind: GoalKind; target: string } | null): string[] {
  if (!goal) return [];
  const field = goal.target.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set([...field, ...KIND_WORDS[goal.kind]])];
}
const STOP = new Set(["and", "the", "for", "with", "into", "from"]);

type Item = { body?: string; tags?: string[]; reason: string; author_id?: string };

/** Matching posts first (in their order), then the rest; matched ones say why. Your own posts keep their place. */
export function goalFirst<T extends Item>(items: T[], goal: { kind: GoalKind; target: string } | null, me: string): T[] {
  const words = goalWords(goal);
  if (!words.length || !goal) return items;
  const label = `Toward your goal: ${GOAL_KINDS[goal.kind].label.toLowerCase()}${goal.target ? ` in ${goal.target}` : ""}`;
  const hit = (p: T) => {
    if (p.author_id === me) return false;
    const text = `${(p.tags ?? []).join(" ")} ${p.body ?? ""}`.toLowerCase();
    return words.some((w) => (w.includes(" ") ? text.includes(w) : new RegExp(`(^|[^a-z0-9])${w.replace(/[+#]/g, "\\$&")}([^a-z0-9]|$)`).test(text)));
  };
  const yes: T[] = [], no: T[] = [];
  for (const p of items) (hit(p) ? yes : no).push(p);
  return [...yes.map((p) => ({ ...p, reason: label })), ...no];
}
