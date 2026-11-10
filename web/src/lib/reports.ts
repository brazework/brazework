"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Reports (supabase/reports.sql and reports-more.sql). The database records who's reported (never the
// reporter's choice), refuses self-reports and duplicates, and shows reports only to Forge admins.
export type ReportKind = "post" | "comment" | "person" | "message" | "chat_message" | "project" | "milestone" | "challenge";
export type ReportState = { ok: boolean; message: string };
const KINDS: ReportKind[] = ["post", "comment", "person", "message", "chat_message", "project", "milestone", "challenge"];
const REASONS = ["spam", "harassment", "hate", "sexual", "violence", "misinformation", "other"] as const;

export async function fileReport(kind: ReportKind, targetId: string, reason: string, detail: string): Promise<ReportState> {
  if (!KINDS.includes(kind) || !targetId) return { ok: false, message: "That can't be reported." };
  if (!(REASONS as readonly string[]).includes(reason)) return { ok: false, message: "Pick a reason." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("content_reports").insert({ kind, target_id: targetId.slice(0, 64), reason, detail: detail.trim().slice(0, 500) });
  if (error) {
    if (error.code === "23505") return { ok: true, message: "You've already reported this. The Forge team has it." };
    return { ok: false, message: error.code === "P0001" ? error.message : friendlyError(error) };
  }
  return { ok: true, message: "Thanks. The Forge team will review it." };
}

export async function resolveReport(id: number, status: "actioned" | "dismissed"): Promise<ReportState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("resolve_report", { p_id: id, p_status: status });
  if (error) return { ok: false, message: error.code === "P0001" || error.code === "42501" ? error.message : friendlyError(error) };
  revalidatePath("/admin");
  return { ok: true, message: status === "actioned" ? "Marked actioned." : "Dismissed." };
}
