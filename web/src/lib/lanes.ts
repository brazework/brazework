// Lanes (docs/superpowers/specs/2026-11-20-playbook-lanes-design.md): every field's playbook has a
// part for studying and a part for working, and the lane belongs to the piece of work, not the
// person: an intern's summer project is working, their rocketry is studying. Kept apart from
// lib/mcp-playbooks.ts (which re-exports these) so the pages' switch can use them without shipping
// the playbooks and prompts to the browser. Pure, and tested (tests/mcp-playbooks.test.ts).

export type Lane = "study" | "work";
export const LANES: Lane[] = ["study", "work"];
/** What a person reads the lanes as; Settings names the two kinds of account the same way. */
export const LANE_LABEL: Record<Lane, string> = { study: "Studying", work: "Working" };

/** A lane from loosely typed words ("Working", " WORK ", "professional", "student"); undefined for anything else. */
export function laneFrom(v?: string | null): Lane | undefined {
  const k = (v ?? "").trim().toLowerCase();
  if (k.startsWith("work") || k.startsWith("professional")) return "work";
  if (k.startsWith("stud")) return "study";
  return undefined;
}

/**
 * The lane to start from, by the rule Home already uses (clubPath, lib/guide-steps.ts): a student is
 * studying, a professional in no club is working. Undefined means ask: a professional who is in a club,
 * or an account type we weren't told. ("professional" is anyone without a school email, so it can't
 * mean "has an employer" by itself.)
 */
export function defaultLane(accountType: string | null | undefined, clubs: number): Lane | undefined {
  if (accountType === "student") return "study";
  if (accountType === "professional" && clubs === 0) return "work";
  return undefined;
}
