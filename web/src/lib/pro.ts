"use server";
import { revalidatePath } from "next/cache";
import { dbFeatures } from "@/lib/db-features";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Pro verification (supabase/pro-verification.sql, Linear FIX-72): engineers at a verified company
// sign off club-verified milestones with a note on what they checked.
export type ProState = { employer: { id: string; name: string } | null; title: string | null; disciplines: string[]; pro: boolean };
export type QueueItem = {
  id: string; title: string; detail: string; evidence: string; achieved_on: string; reviewed_at: string | null; community_id: string; community_name: string; reviewer_name: string;
  project_id: string; project_title: string; project_tags: string[]; owner_id: string; owner_name: string; matches: boolean; pro_reviews: number;
};
type R = { ok: boolean; message: string };
const err = (e: { code?: string; message: string } | null) => (e?.code === "P0001" || e?.code === "42501" ? e.message : friendlyError(e));

export async function proState(): Promise<ProState | null> {
  if (!(await dbFeatures()).proVerification) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const [emp, me] = await Promise.all([
    supabase.rpc("my_employer"),
    supabase.from("profiles").select("pro_org_id, pro_title, pro_disciplines").eq("id", user.id).maybeSingle(),
  ]);
  const p = me.data as { pro_org_id: string | null; pro_title: string | null; pro_disciplines: string[] | null } | null;
  return { employer: (emp.data as ProState["employer"]) ?? null, title: p?.pro_title ?? null, disciplines: p?.pro_disciplines ?? [], pro: Boolean(p?.pro_org_id) };
}

export async function proQueue(): Promise<QueueItem[]> {
  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("pro_review_queue", { p_limit: 20 });
  return (data as QueueItem[] | null) ?? [];
}

export async function becomePro(title: string, disciplines: string[]): Promise<R> {
  const areas = [...new Set(disciplines)].filter((d) => ALL_TOPICS.includes(d)).slice(0, 5);
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("become_pro", { p_title: String(title ?? "").slice(0, 80), p_disciplines: areas });
  if (error) return { ok: false, message: err(error) };
  revalidatePath("/pro");
  return { ok: true, message: "You're set up to review." };
}

export async function proVerify(milestoneId: string, note: string): Promise<R> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(milestoneId)) return { ok: false, message: "That milestone couldn't be found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("pro_review_milestone", { p_milestone: milestoneId, p_note: String(note ?? "").slice(0, 1000) });
  if (error) return { ok: false, message: err(error) };
  // No refresh here: the card stays to say it's signed (it leaves the queue on the next visit).
  return { ok: true, message: "Signed. It shows on their profile now." };
}
