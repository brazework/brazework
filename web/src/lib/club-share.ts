"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Shareable club reports (supabase/club-reports.sql): owners and admins make or revoke the link.
export type ShareState = { ok: boolean; message: string; token?: string };

export async function shareClubReport(clubId: string): Promise<ShareState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("club_report_link", { p_cid: clubId });
  if (error) return { ok: false, message: error.code === "42501" ? error.message : friendlyError(error) };
  revalidatePath(`/c/${clubId}/manage`);
  return { ok: true, message: "Link ready.", token: data as string };
}

export async function revokeClubReport(clubId: string): Promise<ShareState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("revoke_club_report_link", { p_cid: clubId });
  if (error) return { ok: false, message: error.code === "42501" ? error.message : friendlyError(error) };
  revalidatePath(`/c/${clubId}/manage`);
  return { ok: true, message: "The old link no longer works." };
}
