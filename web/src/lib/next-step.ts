// The project page's Next strip (app/(app)/projects/[id]/next-strip.tsx): the one most useful step for
// someone building it, and the "3 signed · 1 waiting" line under its title. Pure, and tested
// (tests/next-step.test.ts). The flow redesign: docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md.
import { goalPath, goalTitle, type Goal, type Record_ } from "@/lib/goals";

// `toward`: the member's goal ("a summer internship in power electronics") when they have one, so the
// step reads as a step toward it; absent when they haven't set one (the strip offers "Set a goal").
export type NextStep = { toward?: string } & (
  | { kind: "ask_sign"; milestoneId: string; title: string; who: string; signers: string[] }
  | { kind: "first_milestone" }
  | { kind: "log_milestone" }
  | { kind: "send_draft"; draftId: string; title: string }
  | { kind: "share_signed"; milestoneId: string; title: string }
);

type M = { id: string; title: string; status: string; community_id?: string | null; community_name?: string | null };

// Gone for good: these don't count as "has a milestone".
const OVER = new Set(["declined", "refused", "revoked"]);

type Input = { builder: boolean; milestones: M[]; drafts: { id: string; title: string }[]; signers?: Map<string, string[]>; goal?: Pick<Goal, "kind" | "target"> | null; record?: Record_ | null };

/**
 * The one step for a builder of this project (null for visitors). Without a goal, in order: a milestone
 * waiting to be signed (ask the people who can sign it), no milestone yet (log the first), a draft from
 * Jig or a tool (send it), something signed (share it). With a goal (lib/goals.ts), the goal's own
 * next step chooses. `signers`: club id → the officers who could sign there (lib/signers.ts).
 */
export function nextStep(i: Input): NextStep | null {
  if (!i.builder) return null;
  if (!i.goal || !i.record) return projectStep(i);
  // With a goal, its own next step (lib/goals.ts goalPath, the same one the goal card shows) picks the
  // move, done on this project; a move this project can't make falls back to the project's own step.
  const toward = goalTitle(i.goal);
  const pending = i.milestones.find((m) => m.status === "pending");
  const signed = i.milestones.find((m) => m.status === "verified");
  const live = i.milestones.some((m) => !OVER.has(m.status));
  const { action } = goalPath(i.goal as Goal, i.record).next;
  const step: NextStep | null =
    action === "See what's waiting" && pending ? askSign(pending, i.signers)
    : action === "Add a milestone" ? (pending ? askSign(pending, i.signers) : live ? { kind: "log_milestone" } : { kind: "first_milestone" })
    : action === "Copy your link" && signed ? { kind: "share_signed", milestoneId: signed.id, title: signed.title }
    : projectStep(i);
  return step && { ...step, toward };
}

function askSign(m: M, signers?: Map<string, string[]>): NextStep {
  const club = m.community_id ? m.community_name || "your club" : "";
  return { kind: "ask_sign", milestoneId: m.id, title: m.title, who: club || "the person you asked", signers: m.community_id ? signers?.get(m.community_id) ?? [] : [] };
}

// Without a goal: a waiting milestone, then the first milestone, then a draft, then something to share.
function projectStep(i: Input): NextStep | null {
  const pending = i.milestones.find((m) => m.status === "pending");
  if (pending) return askSign(pending, i.signers);
  if (!i.milestones.some((m) => !OVER.has(m.status))) return { kind: "first_milestone" };
  const draft = i.drafts[0];
  if (draft) return { kind: "send_draft", draftId: draft.id, title: draft.title };
  const signed = i.milestones.find((m) => m.status === "verified");
  if (signed) return { kind: "share_signed", milestoneId: signed.id, title: signed.title };
  return null;
}

/** "3 signed · 1 waiting" for the project's header; a part with nothing in it is left out. */
export function statusLine(ms: { status: string }[]): string {
  const signed = ms.filter((m) => m.status === "verified").length;
  const waiting = ms.filter((m) => m.status === "pending").length;
  return [signed && `${signed} signed`, waiting && `${waiting} waiting`].filter(Boolean).join(" · ");
}
