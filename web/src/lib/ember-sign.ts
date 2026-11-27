"use server";
import { LINKEDIN_ADD_HERE } from "@/lib/linkedin";
import { needsLinkedin, saveLinkedinFrom } from "@/lib/linkedin-gate";
import { addMilestone, type MilestoneState } from "@/lib/milestones";
import { getViewer } from "@/lib/supabase/server";
import { requestVouch } from "@/lib/vouches";

// What Torch's "Ask them to sign" card does when the member confirms it (Linear FIX-216). Nothing new
// is decided here: a new milestone goes through addMilestone() exactly as the Add milestone dialog
// sends it, and an ask about a milestone that is already waiting goes through requestVouch(). So every
// rule holds unchanged: the limits on asks, the LinkedIn link a working account adds first, throwaway
// inboxes refused, never yourself or anyone on the project, and no milestone left waiting on an ask
// that didn't go out.
export type SignAsk = {
  /** "" for a new milestone; otherwise the member's own milestone that is still waiting for proof. */
  milestone_id: string;
  project_id: string; title: string; evidence: string; detail: string; achieved_on: string;
  email: string; relationship: string;
  /** The member's LinkedIn profile link, when the card asked for it. */
  linkedin?: string;
};

export async function emberAskToSign(a: SignAsk): Promise<MilestoneState> {
  const email = (a.email ?? "").trim();
  if (!email) return { ok: false, message: "Enter the email of the person who saw it." };
  if (!a.milestone_id) {
    const f = new FormData();
    f.set("projectId", a.project_id); f.set("verifyBy", "vouch"); f.set("communityId", "");
    f.set("vouchEmail", email); f.set("vouchRelationship", a.relationship);
    f.set("title", a.title); f.set("detail", a.detail); f.set("evidence", a.evidence); f.set("achievedOn", a.achieved_on);
    f.set("showOnProfile", "on");
    if (a.linkedin) f.set("linkedin", a.linkedin);
    return addMilestone({ ok: false, message: "" }, f);
  }
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  // As in addMilestone: a working account adds its LinkedIn link before the ask (the database holds
  // the rule; this is what lets the card show the field instead of pointing at Settings).
  const bad = await saveLinkedinFrom(supabase, a.linkedin ?? "");
  if (bad) return { ok: false, message: bad, linkedin: true };
  if (await needsLinkedin(supabase)) return { ok: false, message: LINKEDIN_ADD_HERE, linkedin: true };
  return requestVouch(a.milestone_id, email, a.relationship);
}
