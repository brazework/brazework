import { RELATIONSHIPS, type Relationship } from "@/lib/vouch-email";

// What a signer has signed (supabase/signer-tools.sql, my_signatures): vouches from their confirmed
// email, milestones they verified for a club, and Pro sign-offs. Grouped by the person they signed
// for, for a recommendation letter or a review. Pure, so it's unit-tested (tests/signatures.test.ts).

export type Signature = {
  kind: "vouch" | "club" | "pro"; milestone: string; at: string; role: string; club?: string;
  member: { id: string; first: string; last: string };
  title: string; project: string; private: boolean; status: string; wrote: string; how: string;
};
export type SignedFor = { id: string; name: string; items: Signature[]; first: string; last: string };

const OFFICER: Record<string, string> = { owner: "club president", admin: "club officer", moderator: "club officer", helper: "club helper" };

/** "As their professor", "As a club officer of Rocketry Club", "As Senior Engineer at Acme". */
export function signedAs(s: Signature): string {
  if (s.kind === "vouch") return `As ${RELATIONSHIPS[s.role as Relationship] ?? "someone who saw the work"}`;
  if (s.kind === "club") return `As ${OFFICER[s.role] ? `a ${OFFICER[s.role]}` : "an officer"}${s.club ? ` of ${s.club}` : ""}`;
  return `As ${s.role || "a professional"}${s.club ? ` at ${s.club}` : ""}`;
}

/** The person signed for, newest signature first; people ordered by their latest signature. */
export function groupByMember(list: Signature[]): SignedFor[] {
  const by = new Map<string, SignedFor>();
  for (const s of [...list].sort((a, b) => b.at.localeCompare(a.at))) {
    const g = by.get(s.member.id) ?? { id: s.member.id, name: `${s.member.first} ${s.member.last}`.trim() || "A member", first: s.member.first, last: s.member.last, items: [] };
    g.items.push(s);
    by.set(s.member.id, g);
  }
  return [...by.values()];
}

/** A line to quote in a letter: "On Nov 3, 2026, I signed: Static fire at 1.2 kN." (private work: no title). */
export function letterLine(s: Signature): string {
  const day = new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return s.private ? `On ${day}, I signed work they've since made private.` : `On ${day}, I signed: ${s.title}${s.project ? ` (${s.project})` : ""}.`;
}
