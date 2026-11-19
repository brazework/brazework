import { GOAL_KINDS, goalPath, goalTitle, isGoalKind, type GoalKind, type Record_ } from "@/lib/goals";

// my_goal over MCP (supabase/tool-goals.sql): the member's goal, its path and the one next step, built
// with the app's own goalPath() (lib/goals.ts) from the member's real record, so Claude and the app
// say the same thing. Pure, and tested (tests/mcp-goal.test.ts).

type Row = { title: string; project: string; tags?: string[] | null; signed_by?: string; role?: string | null; achieved_on?: string; url?: string; id?: string; status?: string };
export type GoalRead = {
  goal: { kind: string; target: string; visible: boolean; since: string } | null;
  last_reached?: { kind: string; target: string; note: string; at: string } | null;
  record: Record_;
  signed_work: Row[];
  open_work: Row[];
  url: string;
};

// Words, with simple endings ignored (the first five letters of longer words), so "engines" matches "engine".
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2).map((w) => (w.length > 5 ? w.slice(0, 5) : w));

/** How closely a piece of work matches the goal's field: shared words in its title, project and topics. */
export function relevance(target: string, w: Row): number {
  const want = new Set(words(target));
  if (!want.size) return 0;
  const have = words([w.title, w.project, ...(w.tags ?? [])].join(" "));
  return have.filter((x) => want.has(x)).length;
}

/** The goal, its path, the progress line and the next step; or, with no goal, how to set one. */
export function goalSummary(d: GoalRead) {
  if (!d.goal || !isGoalKind(d.goal.kind)) {
    return {
      goal: null, last_reached: d.last_reached ?? null, record: d.record,
      kinds: Object.entries(GOAL_KINDS).map(([kind, k]) => ({ kind, label: k.label })),
      next: "No goal set. Offer once, in one line, to set one (an internship, a first job, grad school, a research lab, a competition or funding, in a field the member names), and carry on as usual if they'd rather not.",
      url: d.url,
    };
  }
  const g = { kind: d.goal.kind as GoalKind, target: d.goal.target };
  const k = GOAL_KINDS[g.kind];
  const path = goalPath(g, d.record);
  const signed = Math.min(d.record.signed, k.target);
  const rank = (rows: Row[]) => [...rows].map((w) => ({ ...w, relevance: relevance(g.target, w) })).sort((a, b) => b.relevance - a.relevance);
  return {
    goal: { ...d.goal, title: goalTitle(g) },
    progress: `${signed} of ${k.target} signed toward ${goalTitle(g)}`,
    path: path.steps.map((s) => ({ step: s.title, state: s.state, detail: s.detail })),
    next: path.next.text,
    who_signs: k.signers,
    // The member's own work, most relevant to the goal first: what to lead with, and what to get signed next.
    strongest: rank(d.signed_work).slice(0, 5),
    to_get_signed: rank(d.open_work).slice(0, 5),
    visible_to_companies: d.goal.visible,
    record: d.record,
    url: d.url,
  };
}
