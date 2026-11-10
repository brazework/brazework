"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { announceMilestone } from "@/lib/connectors/announce";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Club-verified milestones (supabase/milestones.sql). The database enforces who can ask and who
// can verify; these actions validate input and turn database errors into plain sentences.

export type MilestoneState = { ok: boolean; message: string };

const add = z.object({
  projectId: z.string().min(1).max(64),
  communityId: z.string().min(1, "Pick the club that saw it happen.").max(64),
  title: z.string().trim().min(1, "Say what happened.").max(120, "Keep the title under 120 characters."),
  detail: z.string().trim().max(600, "Keep the details under 600 characters."),
  // Evidence is required (supabase/verification.sql): a link to a photo, video, file, commit or the event.
  evidence: z.string().trim().min(1, "Add evidence: a link to a photo, video, file, commit or the club event where it happened.").max(300).refine((v) => /^https:\/\/\S+$/i.test(v), "Evidence has to be a secure web link (https://…)."),
  showOnProfile: z.boolean(),
  achievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it happened."),
});

// Postgres raises plain-English messages from review_milestone() and the insert trigger; pass those on.
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" || e.code === "23514" ? e.message ?? friendlyError(e) : friendlyError(e));

export async function addMilestone(_: MilestoneState, form: FormData): Promise<MilestoneState> {
  const v = add.safeParse({
    projectId: form.get("projectId"), communityId: form.get("communityId"), title: form.get("title"),
    detail: form.get("detail") ?? "", evidence: form.get("evidence") ?? "", achievedOn: form.get("achievedOn"),
    showOnProfile: form.get("showOnProfile") === "on",
  });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to add milestones." };
  const d = v.data;
  const row: Record<string, unknown> = { project_id: d.projectId, community_id: d.communityId, title: d.title, detail: d.detail, evidence: d.evidence, achieved_on: d.achievedOn };
  // Private by default once verification.sql has run; showing it is the member's choice.
  if (d.showOnProfile) row.private = false;
  let { error } = await supabase.from("milestones").insert(row);
  if (error && d.showOnProfile && /private/.test(error.message ?? "")) ({ error } = await supabase.from("milestones").insert({ ...row, private: undefined }));
  if (error) return { ok: false, message: error.code === "42501" ? "You can only ask a club you're a member of, for your own project." : reason(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Sent to the club for verification." };
}

export async function removeMilestone(id: string): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("milestones").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Milestone removed." };
}

export async function reviewMilestone(id: string, verify: boolean, note = ""): Promise<MilestoneState> {
  const n = z.string().max(300, "Keep the note under 300 characters.").safeParse(note.trim());
  if (!n.success) return { ok: false, message: n.error.issues[0]?.message ?? "Check the note." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("review_milestone", { p_id: id, p_verify: verify, p_note: n.data });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath("/c/[id]/manage", "page");
  // Verified milestones are announced in the club's Discord, if connected, after the response.
  if (data === "verified") after(() => announceMilestone(supabase, id));
  return { ok: true, message: data === "verified" ? "Verified. They've been notified." : data === "pending" ? "Approved. It needs one more officer." : "Refused. They've been told why." };
}

// Officers take back a verification, with a reason (the log keeps the record).
export async function revokeMilestone(id: string, why: string): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("revoke_milestone", { p_id: id, p_reason: why.trim().slice(0, 300) });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath("/c/[id]/manage", "page");
  return { ok: true, message: "Revoked. They've been told why." };
}

// The member disputes a refusal or revocation; the club owner decides first.
export async function disputeMilestone(id: string, note: string): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("dispute_milestone", { p_id: id, p_note: note.trim().slice(0, 500) });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Sent to the club's owner." };
}

// The club owner upholds a dispute (it's verified) or rejects it (it goes to Brazework admins).
export async function resolveDispute(id: string, uphold: boolean, note = ""): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("resolve_dispute", { p_id: id, p_uphold: uphold, p_note: note.trim().slice(0, 300) });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath("/c/[id]/manage", "page");
  return { ok: true, message: data === "verified" ? "Upheld: it's verified." : "Sent to Brazework admins to decide." };
}

// Show or hide a milestone on your profile.
export async function setMilestoneVisible(id: string, visible: boolean): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("milestones").update({ private: !visible }).eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: visible ? "Shown on your profile." : "Hidden from your profile." };
}
