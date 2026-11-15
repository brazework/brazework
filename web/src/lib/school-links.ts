"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// A club verified as operating under its school (supabase/school-links.sql, step 56). The club's owner
// or an admin asks; the school's official admins (accounts Brazework sets up) or Brazework admins decide.
export type SchoolLink = { community_id: string; school_name: string; school_domain: string; evidence_url: string; status: "pending" | "verified" | "declined"; requester_at_school: boolean; requested_at: string; decided_at: string | null; decision_note: string };
export type LinkState = { ok: boolean; message: string };

const said = (e: { code?: string; message?: string }) => (e.code === "P0001" || e.code === "42501" ? e.message ?? friendlyError(e) : friendlyError(e));

export async function requestSchoolLink(cid: string, school: string, website: string, evidence: string): Promise<LinkState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("request_school_link", { p_cid: cid, p_school: school, p_website: website, p_evidence: evidence });
  if (error) return { ok: false, message: said(error) };
  revalidatePath(`/c/${cid}`);
  revalidatePath(`/c/${cid}/manage`);
  revalidatePath("/admin");
  return { ok: true, message: "Sent. The school (or the Brazework team, until the school is set up) will review it." };
}

export async function decideSchoolLink(cid: string, approve: boolean, note = ""): Promise<LinkState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("decide_school_link", { p_cid: cid, p_approve: approve, p_note: note });
  if (error) return { ok: false, message: said(error) };
  revalidatePath(`/c/${cid}`);
  revalidatePath("/admin");
  revalidatePath("/org");
  return { ok: true, message: approve ? "Verified." : "Declined." };
}

export async function removeSchoolLink(cid: string): Promise<LinkState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("remove_school_link", { p_cid: cid });
  if (error) return { ok: false, message: said(error) };
  revalidatePath(`/c/${cid}`);
  revalidatePath(`/c/${cid}/manage`);
  return { ok: true, message: "Removed." };
}
