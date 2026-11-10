"use server";
import { z } from "zod";
import { getViewer } from "@/lib/supabase/server";

// Member feedback (supabase/feedback.sql). The database stores it, groups it with similar
// feedback into one idea, grades it, and sends it to the founders' Linear (team Forge).

export type FeedbackKind = "idea" | "problem" | "improvement" | "praise";
export type FeedbackResult =
  | { ok: true; idea: string; joined: boolean; others: number }
  | { ok: false; message: string };

const schema = z.object({
  kind: z.enum(["idea", "problem", "improvement", "praise"], { message: "Choose what kind of feedback this is." }),
  area: z.enum(["general", "feed", "search", "profiles", "communities", "messages", "events", "network", "notifications", "other"], { message: "Choose which part of Brazework this is about." }),
  body: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000, "Keep it under 1,000 characters."),
  mayContact: z.boolean(),
});

export async function sendFeedback(input: { kind: string; area: string; body: string; mayContact: boolean }): Promise<FeedbackResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your feedback." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to send feedback." };
  const d = parsed.data;
  const { data, error } = await supabase.rpc("submit_feedback", { p_kind: d.kind, p_area: d.area, p_body: d.body, p_may_contact: d.mayContact });
  if (error) {
    // The database's own messages are written for members (limits, missing details).
    const mine = ["22023", "P0001", "42501"].includes(error.code ?? "");
    return { ok: false, message: mine ? error.message : "Couldn't send that right now. Please try again in a moment." };
  }
  const r = (data ?? {}) as { idea?: string; joined?: boolean; others?: number };
  return { ok: true, idea: r.idea ?? "", joined: !!r.joined, others: Number(r.others) || 0 };
}
