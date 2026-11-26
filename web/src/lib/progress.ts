// Progress (the dashboard's first view): how a member's work is coming along, from what they log.
// Students and builders who aren't students read it the same way: what they built, how much of it
// someone who saw it has verified (and who: professors, club officers, managers, mentors), the
// tools it was built with, their streak and their goal. Plain sentences first; the page draws small
// charts under them. Pure, so it's tested (tests/progress.test.ts). Grades never come in here: they
// stay private to the course.

import { buildStreak, type Streak } from "./streak";

const DAY = 864e5;

export type MilestoneRow = {
  created_at: string;
  status: string;
  reviewed_at: string | null;
  // Who verified: a vouch's relationship (vouches.sql), or the club role of whoever verified it.
  reviewer_role: string;
  // The community it was logged under: a class ("class") or a club; null when it waits for a vouch.
  community_type: string | null;
  project_id: string | null;
};

export type VerifierKind = "professors" | "officers" | "pis" | "managers" | "mentors" | "others";
export const VERIFIER_LABEL: Record<VerifierKind, string> = {
  professors: "Professors and TAs",
  officers: "Club officers",
  pis: "Lab PIs",
  managers: "Managers and coworkers",
  mentors: "Mentors",
  others: "Others who saw it",
};
const VOUCH: Record<string, VerifierKind> = { professor: "professors", ta: "professors", pi: "pis", manager: "managers", mentor: "mentors", other: "others" };

export function verifierKind(m: Pick<MilestoneRow, "reviewer_role" | "community_type">): VerifierKind {
  if (m.reviewer_role in VOUCH) return VOUCH[m.reviewer_role];
  return m.community_type === "class" ? "professors" : "officers";
}

export type Point = { bucket: string; value: number };

export type Progress = {
  // In the chosen period.
  logged: number;
  verified: number;
  share: number | null;
  medianDays: number | null;
  loggedSeries: Point[];
  verifiedSeries: Point[];
  // Now, whatever the period.
  waiting: number;
  everLogged: number;
  everVerified: number;
  byKind: { kind: VerifierKind; label: string; n: number }[];
  tools: { tool: string; n: number; fresh: boolean }[];
  streak: Streak;
  goal: { title: string; since: string; verified: number } | null;
  summary: string[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// "less than a day", "1 day", "2.5 days".
export function days(d: number): string {
  if (d < 1) return "less than a day";
  const r = Math.round(d * 2) / 2;
  return `${r % 1 ? r.toFixed(1) : r} ${r === 1 ? "day" : "days"}`;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Each time in the latest bucket that starts on or before it (buckets are "YYYY-MM-DD", UTC).
function bucketize(buckets: string[], times: number[]): Point[] {
  const starts = buckets.map((b) => Date.parse(`${b}T00:00:00Z`));
  const counts = buckets.map(() => 0);
  for (const t of times) for (let i = starts.length - 1; i >= 0; i--) if (t >= starts[i]) { counts[i]++; break; }
  return buckets.map((bucket, i) => ({ bucket, value: counts[i] }));
}

export function buildProgress(input: {
  milestones: MilestoneRow[];
  // Each project's "Built with" tools (project-stack.sql).
  tools: Record<string, string[]>;
  // Everything that counts toward the weekly streak (posts and milestones), as times.
  activity: number[];
  buckets: string[];
  since: number;
  now: number;
  // The period in words, for the sentences: "30 days", "12 months".
  period: string;
  goal: { title: string; created_at: string } | null;
}): Progress {
  const { milestones: ms, since, now } = input;
  const t = (s: string | null) => (s ? Date.parse(s) : NaN);
  const inRange = ms.filter((m) => t(m.created_at) >= since);
  const verifiedAll = ms.filter((m) => m.status === "verified" && m.reviewed_at);
  const verifiedInRange = verifiedAll.filter((m) => t(m.reviewed_at) >= since);
  const loggedVerified = inRange.filter((m) => m.status === "verified").length;
  const medianDays = median(verifiedInRange.map((m) => Math.max(0, (t(m.reviewed_at) - t(m.created_at)) / DAY)));

  const kinds = new Map<VerifierKind, number>();
  for (const m of verifiedAll) { const k = verifierKind(m); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
  const byKind = [...kinds.entries()].map(([kind, n]) => ({ kind, label: VERIFIER_LABEL[kind], n })).sort((a, b) => b.n - a.n);

  // Tools: how many milestones each was behind, and whether it's new in this period (first used in it).
  const count = new Map<string, number>(), first = new Map<string, number>();
  for (const m of ms) for (const tool of (m.project_id && input.tools[m.project_id]) || []) {
    const key = tool.trim();
    if (!key) continue;
    count.set(key, (count.get(key) ?? 0) + 1);
    first.set(key, Math.min(first.get(key) ?? Infinity, t(m.created_at)));
  }
  const tools = [...count.entries()].map(([tool, n]) => ({ tool, n, fresh: (first.get(tool) ?? 0) >= since })).sort((a, b) => b.n - a.n || a.tool.localeCompare(b.tool)).slice(0, 8);

  const streak = buildStreak(input.activity, now);
  const goal = input.goal ? { title: input.goal.title, since: input.goal.created_at, verified: verifiedAll.filter((m) => t(m.reviewed_at) >= t(input.goal!.created_at)).length } : null;
  const waiting = ms.filter((m) => m.status === "pending").length;

  // The summary: what happened, how fast it was verified (or what waits), and where it's heading.
  const summary: string[] = [];
  if (!ms.length) summary.push("Nothing logged yet. Log what you finished, with the file that shows it, and ask whoever saw it to verify.");
  else {
    summary.push(inRange.length
      ? `You logged ${plural(inRange.length, "milestone")} in the last ${input.period}${loggedVerified ? `, and ${loggedVerified} ${loggedVerified === 1 ? "is" : "are"} verified` : ""}.`
      : `Nothing new logged in the last ${input.period}. You have ${plural(ms.length, "milestone")} in all.`);
    if (medianDays !== null) summary.push(`Verification took ${days(medianDays)}, typically${waiting ? `, and ${plural(waiting, "milestone")} ${waiting === 1 ? "waits" : "wait"} for whoever saw it` : ""}.`);
    else if (waiting) summary.push(`${plural(waiting, "milestone")} ${waiting === 1 ? "waits" : "wait"} for whoever saw the work to verify ${waiting === 1 ? "it" : "them"}.`);
    if (goal) summary.push(`${plural(goal.verified, "verified milestone")} since you set your goal: ${goal.title}.`);
    else if (streak.weeks > 1) summary.push(`You've shown work ${streak.weeks} weeks in a row.`);
  }

  return {
    logged: inRange.length,
    verified: verifiedInRange.length,
    share: inRange.length ? Math.round((loggedVerified / inRange.length) * 100) : null,
    medianDays,
    loggedSeries: bucketize(input.buckets, inRange.map((m) => t(m.created_at))),
    verifiedSeries: bucketize(input.buckets, verifiedInRange.map((m) => t(m.reviewed_at))),
    waiting,
    everLogged: ms.length,
    everVerified: verifiedAll.length,
    byKind,
    tools,
    streak,
    goal,
    summary,
  };
}
