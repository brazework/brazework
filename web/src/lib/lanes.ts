// Lanes (docs/superpowers/specs/2026-11-20-playbook-lanes-design.md): every field's playbook has a
// part for studying and a part for working, and the lane belongs to the piece of work, not the
// person: an intern's summer project is working, their rocketry is studying. Kept apart from
// lib/mcp-playbooks.ts (which re-exports these) so the pages' switch can use them without shipping
// the playbooks and prompts to the browser. Pure, and tested (tests/mcp-playbooks.test.ts).

export type Lane = "study" | "work";
export const LANES: Lane[] = ["study", "work"];
/** What a person reads the lanes as; Settings names the two kinds of account the same way. */
export const LANE_LABEL: Record<Lane, string> = { study: "Studying", work: "Working" };

/**
 * A lane from the words people actually type: "Working", "at work", "my job", "internship", "a client
 * project"; "Studying", "school", "a class project", "my club". Work wins when both show ("student
 * job"), because its rules are the careful ones. Undefined for anything else ("studio", "banana"); the
 * prompt then says the word back and asks.
 */
export function laneFrom(v?: string | null): Lane | undefined {
  const k = (v ?? "").trim().toLowerCase();
  if (/\b(work|job|intern|employ|client|professional|freelanc|contract)/.test(k)) return "work";
  if (/\b(stud(y|ying|ent|ents)\b|school|class|club|course)/.test(k)) return "study";
  return undefined;
}

/** What the guide and Settings say about work. An assistant is told this; Brazework can't make it. */
export const WORK_NOTE = "At work your assistant is told to ask whether your employer allows it before it reads a tool, and the milestone stays hidden until you show it.";

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
