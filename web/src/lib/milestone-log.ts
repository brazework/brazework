// A project's milestone log on a profile (Linear FIX-240): it starts folded to one line, so a long
// build log doesn't push the rest of the profile down, and opens when someone wants the detail.
// Pure helpers, so the wording and the rules are unit-tested (tests/milestone-log.test.ts).

type LogItem = { id: string; status: string; achieved_on: string };

// Signed = verified by a club or signed by a person. Backed by GitHub is not signed, on purpose.
const signed = (m: LogItem) => m.status === "verified";

const shortDay = (d: string, now: Date) => {
  const at = new Date(`${d}T12:00:00Z`);
  const sameYear = at.getUTCFullYear() === now.getUTCFullYear();
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
};

// "8 milestones · 5 signed · latest Nov 18". The year shows only when it isn't this year's.
export function logSummary(items: LogItem[], now = new Date(), own = false): string {
  if (!items.length) return "";
  const n = items.length;
  const s = items.filter(signed).length;
  const waiting = own ? items.filter((m) => m.status === "pending").length : 0;
  const latest = items.reduce((a, m) => (m.achieved_on > a ? m.achieved_on : a), items[0].achieved_on);
  return [`${n} ${n === 1 ? "milestone" : "milestones"}`, ...(s ? [`${s} signed`] : []), ...(waiting ? [`${waiting} waiting`] : []), `latest ${shortDay(latest, now)}`].join(" · ");
}

// The most recent signed one, shown under the summary so the proof is visible without opening anything.
export function latestSigned<T extends LogItem>(items: T[]): T | null {
  return items.filter(signed).reduce<T | null>((a, m) => (!a || m.achieved_on > a.achieved_on ? m : a), null);
}

// One milestone is the log: folding it would only repeat it under its own summary.
export const logFolds = (items: LogItem[]) => items.length > 1;

// Each milestone's anchor, and the milestone a #milestone-… link points at (null for any other hash).
export const milestoneAnchor = (id: string) => `milestone-${id}`;
export function anchoredMilestone(hash: string): string | null {
  const m = /^#milestone-(.+)$/.exec(hash);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}
