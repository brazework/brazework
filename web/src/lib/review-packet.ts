// The review packet (/u/<id>/review): a member's signed milestones over a date range, printable, for a
// performance review. Only work someone else signed: a club officer verified it, or a professor,
// manager or mentor vouched for it, with their name, role, date and words. Pure, so the range and the
// wording are tested (tests/review-packet.test.ts). Gated by lib/plans.ts (FEATURE_ACCESS.reviewPacket).

export type PacketItem = {
  id: string; project_id: string; project: string; title: string; detail: string; achieved_on: string;
  community_name: string; reviewer_name: string; reviewer_role: string; reviewed_at: string | null; review_note: string;
  vouched_by: string; evidence: string; evidence_items: { type: string; url?: string }[]; private: boolean;
  pro: { reviewer_name: string; reviewer_title: string; employer_name: string; note: string; created_at: string }[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const day = (d: Date) => d.toISOString().slice(0, 10);

/** The date range from the URL: defaults to the last 12 months; never backwards; at most 5 years. */
export function packetRange(from: string | undefined, to: string | undefined, today: Date): { from: string; to: string } {
  const end = to && ISO.test(to) && !Number.isNaN(Date.parse(to)) ? to : day(today);
  const yearAgo = new Date(`${end}T12:00:00Z`); yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1); yearAgo.setUTCDate(yearAgo.getUTCDate() + 1);
  let start = from && ISO.test(from) && !Number.isNaN(Date.parse(from)) ? from : day(yearAgo);
  if (start > end) start = end;
  const floor = new Date(`${end}T12:00:00Z`); floor.setUTCFullYear(floor.getUTCFullYear() - 5);
  if (start < day(floor)) start = day(floor);
  return { from: start, to: end };
}

const ROLES: Record<string, string> = {
  owner: "club president", admin: "club officer", moderator: "club officer", helper: "club helper",
  professor: "professor", ta: "teaching assistant", pi: "lab PI", manager: "manager", mentor: "mentor", other: "witness",
};
export const fmtDay = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

/** Who signed it, in their role: "Dr. Priya Lee, Assistant Professor · utexas.edu (professor)" or "Maya P., club officer of Rocketry Club". */
export function packetSigner(m: Pick<PacketItem, "vouched_by" | "reviewer_name" | "reviewer_role" | "community_name">): string {
  const role = ROLES[m.reviewer_role] ?? m.reviewer_role;
  if (m.vouched_by) return `${m.vouched_by}${role ? ` (${role})` : ""}`;
  return `${m.reviewer_name || "A club officer"}${role ? `, ${role}` : ""}${m.community_name ? ` of ${m.community_name}` : ""}`;
}

/** The evidence links (https only), the old single link first. */
export function packetLinks(m: Pick<PacketItem, "evidence" | "evidence_items">): string[] {
  return [...new Set([m.evidence, ...m.evidence_items.map((e) => e.url ?? "")].filter((u) => /^https:\/\//.test(u)))];
}

/** The line under the heading: "7 signed milestones across 3 projects, signed by 4 people". */
export function packetSummary(items: Pick<PacketItem, "project_id" | "vouched_by" | "reviewer_name">[]): string {
  if (!items.length) return "No signed milestones in this period.";
  const projects = new Set(items.map((i) => i.project_id)).size;
  const people = new Set(items.map((i) => i.vouched_by || i.reviewer_name)).size;
  const p = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  return `${p(items.length, "signed milestone")} across ${p(projects, "project")}, signed by ${p(people, "person", "people")}`;
}
