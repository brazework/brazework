"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { createClient } from "@/lib/supabase/server";

// Claiming a club (supabase/club-claims.sql): an officer asks to take over a club someone else
// started; a Brazework admin decides on /admin. The database checks everything again.
export type ClaimState = { ok: boolean; message: string };

const say = (error: { code?: string; message: string }) => (error.code === "P0001" || error.code === "42501" ? error.message : friendlyError(error));

export async function requestClaim(_: ClaimState, form: FormData): Promise<ClaimState> {
  const cid = String(form.get("cid") ?? "");
  const role = String(form.get("role") ?? "").trim().slice(0, 80);
  const evidence = String(form.get("evidence") ?? "").trim().slice(0, 600);
  if (role.length < 2) return { ok: false, message: "Say what your role is, for example “President”." };
  if (evidence.length < 10) return { ok: false, message: "Add how we can check it: a link to a page listing the officers, or who can confirm it." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_club_claim", { p_cid: cid, p_role: role, p_evidence: evidence });
  if (error) return { ok: false, message: say(error) };
  revalidatePath(`/c/${cid}/claim`);
  return { ok: true, message: "Sent. The Brazework team checks it, usually within two days, and you'll get a notification either way." };
}

export async function withdrawClaim(id: number, cid: string): Promise<ClaimState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_club_claim", { p_id: id });
  if (error) return { ok: false, message: say(error) };
  revalidatePath(`/c/${cid}/claim`);
  return { ok: true, message: "Withdrawn." };
}

export async function decideClaim(id: number, approve: boolean, note: string): Promise<ClaimState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_club_claim", { p_id: id, p_approve: approve, p_note: note.slice(0, 300) });
  if (error) return { ok: false, message: say(error) };
  revalidatePath("/admin");
  return { ok: true, message: approve ? "Approved: they own the club now." : "Denied." };
}
