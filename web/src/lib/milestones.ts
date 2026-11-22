"use server";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { verifyTag } from "@/lib/verify-load";
import { LINKEDIN_ADD_HERE } from "@/lib/linkedin";
import { needsLinkedin, saveLinkedinFrom } from "@/lib/linkedin-gate";
import { requestVouch } from "@/lib/vouches";
import { backingMessage } from "@/lib/backing";
import { checkBacking, recordBacking } from "@/lib/backing-check";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { proofUrl } from "@/lib/proof-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProofSharedEmail } from "@/lib/witness-invite";

// Club-verified milestones (supabase/milestones.sql), or, with no club, vouched for by someone who
// saw it (supabase/vouches.sql), or, with nobody asked, backed by the member's own GitHub work
// (supabase/backed.sql, lib/backing-check.ts). The database enforces who can ask and who can verify; these actions
// validate input and turn database errors into plain sentences.

// linkedin: the ask needs the member's LinkedIn link first; the form shows the field (Linear FIX-214).
export type MilestoneState = { ok: boolean; message: string; linkedin?: boolean };

const add = z.object({
  projectId: z.string().min(1).max(64),
  // Either the club that saw it, or someone who saw it (any real address; throwaway inboxes are refused).
  verifyBy: z.enum(["club", "vouch", "data"]),
  communityId: z.string().max(64),
  vouchEmail: z.string().trim().max(254),
  vouchRelationship: z.string().max(20),
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
    projectId: form.get("projectId"), verifyBy: form.get("verifyBy") === "vouch" ? "vouch" : form.get("verifyBy") === "data" ? "data" : "club",
    communityId: form.get("communityId") ?? "", vouchEmail: form.get("vouchEmail") ?? "", vouchRelationship: form.get("vouchRelationship") ?? "", title: form.get("title"),
    detail: form.get("detail") ?? "", evidence: form.get("evidence") ?? "", achievedOn: form.get("achievedOn"),
    showOnProfile: form.get("showOnProfile") === "on",
  });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to add milestones." };
  const d = v.data;
  if (d.verifyBy === "club" && !d.communityId) return { ok: false, message: "Pick the club that saw it happen." };
  if (d.verifyBy === "vouch" && !d.vouchEmail) return { ok: false, message: "Enter the email of the person who saw it." };
  // Asking a person to sign: a working account adds its LinkedIn link first. The form can carry it;
  // checked before anything is saved (the database holds the rule where the ask is saved).
  if (d.verifyBy === "vouch") {
    const bad = await saveLinkedinFrom(supabase, form.get("linkedin"));
    if (bad) return { ok: false, message: bad, linkedin: true };
    if (await needsLinkedin(supabase)) return { ok: false, message: LINKEDIN_ADD_HERE, linkedin: true };
  }
  // Nobody asked: check GitHub first, so nothing is saved unless it's the member's own work.
  const backing = d.verifyBy === "data" ? await checkBacking(d.evidence, d.projectId, user.id) : null;
  if (backing && !backing.ok) return { ok: false, message: backingMessage(backing.reason) };
  const row: Record<string, unknown> = { project_id: d.projectId, community_id: d.verifyBy === "club" ? d.communityId : null, title: d.title, detail: d.detail, evidence: d.evidence, achieved_on: d.achievedOn };
  if (d.verifyBy === "data") row.status = "logged";
  // Private by default once verification.sql has run; showing it is the member's choice.
  if (d.showOnProfile) row.private = false;
  let { data: made, error } = await supabase.from("milestones").insert(row).select("id").single();
  if (error && d.showOnProfile && /private/.test(error.message ?? "")) ({ data: made, error } = await supabase.from("milestones").insert({ ...row, private: undefined }).select("id").single());
  if (error || !made) return { ok: false, message: error?.code === "42501" ? "You can only ask a club you're a member of, for your own project." : reason(error ?? {}) };
  if (backing?.ok) {
    if (!(await recordBacking(made.id, backing.facts))) {
      await supabase.from("milestones").delete().eq("id", made.id).eq("owner_id", user.id);
      return { ok: false, message: backingMessage("already_used") };
    }
    revalidatePath(`/u/${user.id}`);
    return { ok: true, message: d.showOnProfile ? "Backed by GitHub. It's on your profile now." : "Backed by GitHub. Show it on your profile when you're ready." };
  }
  // Sent for signing: if the evidence is the member's own GitHub work, back it too (quietly; a
  // GitHub outage never stops the ask).
  if (/^https:\/\/github\.com\//i.test(d.evidence)) {
    const extra = await checkBacking(d.evidence, d.projectId, user.id).catch(() => null);
    if (extra?.ok) await recordBacking(made.id, extra.facts).catch(() => false);
  }
  if (d.verifyBy === "vouch") {
    const asked = await requestVouch(made.id, d.vouchEmail, d.vouchRelationship);
    // No ask went out: don't leave a milestone waiting on nobody.
    if (!asked.ok) { await supabase.from("milestones").delete().eq("id", made.id).eq("owner_id", user.id); return asked; }
    revalidatePath(`/u/${user.id}`);
    return asked;
  }
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Sent to the club for verification." };
}

// More evidence after it's logged (FIX-238, supabase/milestone-late-evidence.sql): a link added to a
// milestone that's already signed keeps the signature and says it came after signing.
export type EvidenceItem = { type: string; url?: string; added_at?: string; after_signing?: boolean };
export async function addMilestoneEvidence(id: string, url: string): Promise<MilestoneState & { item?: EvidenceItem }> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const clean = url.trim().replace(/^(?!https?:\/\/)/i, "https://").replace(/^http:\/\//i, "https://");
  const { data, error } = await supabase.rpc("add_milestone_evidence", { p_id: id, p_url: clean });
  if (error) return { ok: false, message: error.code === "PGRST202" ? "Adding evidence later isn't switched on yet." : error.code === "42501" ? error.message ?? "Only the owner can add evidence." : reason(error) };
  revalidatePath(`/u/${user.id}`);
  const item = data as EvidenceItem;
  return { ok: true, message: item.after_signing ? "Added. It shows as added after signing." : "Added.", item };
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
  updateTag(verifyTag(id));
  return { ok: true, message: data === "verified" ? "Verified. They've been notified." : data === "pending" ? "Approved. It needs one more officer." : "Refused. They've been told why." };
}

// Officers take back a verification, with a reason (the log keeps the record).
export async function revokeMilestone(id: string, why: string): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("revoke_milestone", { p_id: id, p_reason: why.trim().slice(0, 300) });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath("/c/[id]/manage", "page");
  updateTag(verifyTag(id)); // its verify page says revoked at once
  return { ok: true, message: "Revoked. They've been told why." };
}

// The member disputes a refusal or revocation; the club owner decides first.
export async function disputeMilestone(id: string, note: string): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("dispute_milestone", { p_id: id, p_note: note.trim().slice(0, 500) });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath(`/u/${user.id}`);
  updateTag(verifyTag(id));
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
async function tellVoucher(milestoneId: string, memberId: string, title: string) {
  const m = mailer();
  const db = createAdminClient();
  if (!m.enabled || !db) return;
  const [{ data: v }, { data: me }] = await Promise.all([
    db.from("milestone_vouches").select("email").eq("milestone_id", milestoneId).eq("state", "vouched").order("answered_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("profiles").select("first_name, last_name").eq("id", memberId).maybeSingle(),
  ]);
  if (!v?.email) return;
  await m.send(buildProofSharedEmail({ to: v.email as string, member: `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim(), title, cardUrl: proofUrl(env.siteUrl, milestoneId), signupUrl: `${env.siteUrl.replace(/\/$/, "")}/signup` }));
}

/** Shares one signed or backed result as a public link (/p/<id>), or stops sharing it (FIX-128). */
export async function shareMilestone(id: string, on: boolean): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data: before } = await supabase.from("milestones").select("title, status, shared_at, vouched_by").eq("id", id).eq("owner_id", user.id).maybeSingle();
  const { error } = await supabase.rpc("share_milestone", { p_id: id, p_on: on });
  if (error) return { ok: false, message: reason(error) };
  // The first time it's shared, someone who vouched for it by email hears about it, once (FIX-129). A
  // member who signed it gets a notification from the database instead. Never blocks the share.
  if (on && before && !before.shared_at && before.status === "verified" && before.vouched_by) await tellVoucher(id, user.id, before.title as string).catch(() => {});
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: on ? "Anyone with the link can see it now." : "Stopped sharing. The link no longer works." };
}

export async function setMilestoneVisible(id: string, visible: boolean): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("milestones").update({ private: !visible }).eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  updateTag(verifyTag(id)); // hiding it takes its verify page down at once
  return { ok: true, message: visible ? "Shown on your profile." : "Hidden from your profile." };
}

// Proof without revealing confidential work (supabase/redacted-proof.sql): the one public line a private
// milestone shows other members. Only the owner writes it; the database checks it.
export async function setPublicLine(id: string, line: string): Promise<MilestoneState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("set_public_line", { p_id: id, p_line: line.slice(0, 200) });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : error.code === "42501" ? "Only the owner writes this line." : friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: data ? "Saved. Other members see this line, not the milestone." : "Cleared." };
}
