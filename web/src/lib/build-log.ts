// A project as a live build log (Linear FIX-92). Pure functions over what the project page already
// loads (its updates and milestones), so they're easy to test: tests/build-log.test.ts.

const DAY = 864e5;
const WEEK = 7 * DAY;

/** Activity per week for the last `weeks` weeks, oldest first (the newest week ends now). */
export function weeklyActivity(times: number[], now: number, weeks = 12): number[] {
  const out = Array<number>(weeks).fill(0);
  for (const t of times) {
    const ago = Math.floor((now - t) / WEEK);
    if (ago >= 0 && ago < weeks) out[weeks - 1 - ago]++;
  }
  return out;
}

/** The newest moment anything happened on the project: an update, a verified milestone or an edit. */
export function lastActivity(times: (number | null | undefined)[]): number | null {
  const ok = times.filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  return ok.length ? Math.max(...ok) : null;
}

/** "Building", "Shipped" or "Quiet": where the project stands, honestly. Quiet after three weeks. */
export function liveStatus(status: "in_progress" | "completed", last: number | null, now: number): "building" | "shipped" | "quiet" {
  if (status === "completed") return "shipped";
  return last !== null && now - last < 21 * DAY ? "building" : "quiet";
}

export type LogMilestone = { id: string; title: string; reviewer_name: string; community_name: string; reviewed_at?: string | null; achieved_on: string; status: string };
export type LogEntry<P> = { kind: "post"; at: number; post: P } | { kind: "verified"; at: number; milestone: LogMilestone };

/** One timeline, newest first: the project's updates, and the moments its club verified a milestone. */
export function buildLog<P extends { id: string; created_at: string }>(posts: P[], milestones: LogMilestone[]): LogEntry<P>[] {
  const entries: LogEntry<P>[] = [
    ...posts.map((post) => ({ kind: "post" as const, at: Date.parse(post.created_at), post })),
    ...milestones
      .filter((m) => m.status === "verified")
      .map((milestone) => ({ kind: "verified" as const, at: Date.parse(milestone.reviewed_at || milestone.achieved_on), milestone })),
  ];
  return entries.filter((e) => Number.isFinite(e.at)).sort((a, b) => b.at - a.at);
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The 30-second version for someone hiring: what it is, the proof, the momentum, the stack. Facts only. */
export function inThirtySeconds(p: {
  owner: string; title: string; summary: string; status: "in_progress" | "completed"; teamSize: number;
  verified: { title: string; reviewer: string; club: string }[]; activeWeeks: number; weeks: number; updates: number; tools: string[];
}): string[] {
  const lines: string[] = [];
  const who = p.teamSize > 1 ? `${p.owner} and ${p.teamSize - 1} ${p.teamSize === 2 ? "teammate" : "teammates"}` : p.owner;
  const verb = p.status === "completed" ? "built" : p.teamSize > 1 ? "are building" : "is building";
  lines.push(`${who} ${verb} ${p.title}${p.summary ? `: ${p.summary.replace(/\s+/g, " ").trim().replace(/\.$/, "")}` : ""}.`);
  if (p.verified.length) {
    const latest = p.verified[0];
    const clubs = [...new Set(p.verified.map((v) => v.club))];
    lines.push(`${p.verified.length} ${p.verified.length === 1 ? "milestone" : "milestones"} verified by ${list(clubs)}, most recently "${latest.title}"${latest.reviewer ? `, signed by ${latest.reviewer}` : ""}.`);
  } else {
    lines.push("No club-verified milestones yet.");
  }
  if (p.updates) lines.push(`Active ${p.activeWeeks} of the last ${p.weeks} weeks, with ${p.updates} ${p.updates === 1 ? "update" : "updates"} logged.`);
  if (p.tools.length) lines.push(`Built with ${list(p.tools.slice(0, 5))}${p.tools.length > 5 ? " and more" : ""}.`);
  return lines;
}
