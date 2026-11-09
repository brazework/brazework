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
  evidence: z.string().trim().max(300).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Evidence has to be a web link (https://…)."),
  achievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it happened."),
});

// Postgres raises plain-English messages from review_milestone() and the insert trigger; pass those on.
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" || e.code === "23514" ? e.message ?? friendlyError(e) : friendlyError(e));

export async function addMilestone(_: MilestoneState, form: FormData): Promise<MilestoneState> {
  const v = add.safeParse({
    projectId: form.get("projectId"), communityId: form.get("communityId"), title: form.get("title"),
    detail: form.get("detail") ?? "", evidence: form.get("evidence") ?? "", achievedOn: form.get("achievedOn"),
  });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to add milestones." };
  const d = v.data;
  const { error } = await supabase.from("milestones").insert({ project_id: d.projectId, community_id: d.communityId, title: d.title, detail: d.detail, evidence: d.evidence, achieved_on: d.achievedOn });
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
  return { ok: true, message: data === "verified" ? "Verified. They've been notified." : "Declined. They've been told why." };
}
