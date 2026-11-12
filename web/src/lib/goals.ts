// Goals (supabase/goals.sql, Linear FIX-95): what a member is working toward, and their path to it.
// Pure, so the path and the next step are unit-tested (tests/goals.test.ts). The path is built from
// what's really on their record: projects, milestones signed (by a club or a vouch), milestones still
// waiting, and who looked.

export const GOAL_KINDS = {
  internship: { label: "Internship", title: "a summer internship", target: 3, signers: "your club or a mentor", looking: "companies hiring interns" },
  job: { label: "First job", title: "your first full-time role", target: 4, signers: "a manager or your club", looking: "hiring teams" },
  grad: { label: "Grad school", title: "grad school", target: 2, signers: "a professor or PI", looking: "grad programs" },
  research: { label: "Research lab", title: "a spot in a research lab", target: 2, signers: "the PI or a TA", looking: "labs" },
  competition: { label: "Competition", title: "a competition win", target: 6, signers: "your club's officers", looking: "sponsors" },
  funding: { label: "Funding", title: "funding for what you build", target: 3, signers: "a professor or a partner", looking: "sponsors and funds" },
} as const;
export type GoalKind = keyof typeof GOAL_KINDS;
export const isGoalKind = (k: unknown): k is GoalKind => typeof k === "string" && k in GOAL_KINDS;

export type Goal = { id: number; kind: GoalKind; target: string; visible: boolean; status: "active" | "met" | "dropped"; met_note: string; created_at: string; closed_at: string | null };
export type Record_ = { projects: number; signed: number; waiting: number; looked: number };

export type Step = { key: "build" | "sign" | "found"; title: string; detail: string; state: "done" | "now" | "next" };
// href "share" means: copy the profile link (the card renders a copy button for it).
export type Next = { text: string; href: string; action: string };

/** "a summer internship in power electronics" */
export function goalTitle(g: Pick<Goal, "kind" | "target">): string {
  const t = GOAL_KINDS[g.kind].title;
  return g.target ? `${t} in ${g.target}` : t;
}

export function goalPath(g: Pick<Goal, "kind" | "target">, r: Record_): { steps: Step[]; done: number; next: Next } {
  const k = GOAL_KINDS[g.kind];
  const built = r.projects > 0;
  const signed = Math.min(r.signed, k.target);
  const proven = r.signed >= k.target;
  const steps: Step[] = [
    { key: "build", title: "Build", detail: built ? `${r.projects} ${r.projects === 1 ? "project" : "projects"} on your record` : "Add what you're working on", state: built ? "done" : "now" },
    { key: "sign", title: "Get it signed", detail: `${signed} of ${k.target} milestones signed by ${k.signers}${r.waiting ? ` · ${r.waiting} waiting` : ""}`, state: proven ? "done" : built ? "now" : "next" },
    { key: "found", title: "Get found", detail: r.looked ? `${r.looked} ${r.looked === 1 ? "person" : "people"} looked this month` : `Visible to ${k.looking} searching your field`, state: proven && r.looked > 0 ? "done" : proven ? "now" : "next" },
  ];
  const done = steps.filter((s) => s.state === "done").length;
  return { steps, done, next: nextStep(g, r) };
}

/** The one thing to do next, in plain words, with where to do it. */
export function nextStep(g: Pick<Goal, "kind" | "target">, r: Record_): Next {
  const k = GOAL_KINDS[g.kind];
  if (r.projects === 0) return { text: `Add the project you're working toward ${k.title} with: what it is, what it's built with, a photo or a link.`, href: "#projects", action: "Add a project" };
  if (r.waiting > 0) return { text: `${r.waiting} ${r.waiting === 1 ? "milestone is" : "milestones are"} waiting to be signed. A quick nudge to ${k.signers} usually does it.`, href: "#projects", action: "See what's waiting" };
  if (r.signed < k.target) {
    const left = k.target - r.signed;
    return { text: `Log your next result as a milestone (${left} more to go) and ask ${k.signers} who saw it to sign it.`, href: "#projects", action: "Add a milestone" };
  }
  if (r.looked === 0) return { text: `Your proof is ready. Send your page to ${k.looking} you'd like to work with; it's the link that replaces a résumé.`, href: "share", action: "Copy your link" };
  return { text: `${r.looked} ${r.looked === 1 ? "person" : "people"} looked this month. Keep the log going weekly and answer your Requests.`, href: "/messages", action: "Open Requests" };
}
