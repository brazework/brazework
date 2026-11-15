"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Study groups (supabase/study-groups.sql): confirm, or take back, that another member led the
// group's sessions. The database checks you're both members, that it's a study group, and that you
// aren't confirming yourself; this turns its refusals into sentences.

export type StudyResult = { ok: boolean; message: string };
const ids = z.object({ cid: z.string().trim().min(1).max(64), leader: z.string().uuid() });
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" || e.code === "42501" ? e.message ?? friendlyError(e) : friendlyError(e));

export async function setStudyLead(cid: string, leader: string, confirmed: boolean): Promise<StudyResult> {
  const p = ids.safeParse({ cid, leader });
  if (!p.success) return { ok: false, message: "That member isn't in this group." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc(confirmed ? "confirm_study_lead" : "unconfirm_study_lead", { p_cid: p.data.cid, p_leader: p.data.leader });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath(`/c/${p.data.cid}`);
  revalidatePath(`/u/${p.data.leader}`);
  return { ok: true, message: confirmed ? "Confirmed. It shows on their profile as proof." : "Taken back." };
}
