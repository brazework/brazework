"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { billing } from "@/lib/billing";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Sponsored challenges (supabase/challenges.sql). The database decides who can create, publish,
// enter and judge; these actions validate input and turn database errors into plain sentences.

export type ChallengeState = { ok: boolean; message: string; id?: string };
const reason = (e: { message?: string; code?: string }) =>
  e.code === "P0001" || e.code === "42501" || e.code === "23514" ? e.message ?? friendlyError(e) : e.code === "23505" ? "That project is already entered." : friendlyError(e);
const refresh = (id?: string) => {
  revalidatePath("/challenges");
  if (id) revalidatePath(`/challenges/${id}`);
  revalidatePath("/org");
};

const draft = z.object({
  orgId: z.string().min(1),
  title: z.string().trim().min(4, "Give it a title (4+ characters).").max(120),
  brief: z.string().trim().min(20, "Describe what to build and how you'll judge it (20+ characters).").max(4000),
  prize: z.string().trim().max(200),
  topic: z.string().trim().max(60),
  deadline: z.iso.datetime({ offset: true, message: "Pick a deadline." }),
}).refine((v) => Date.parse(v.deadline) > Date.now() + 86400000, { message: "Set a deadline at least a day away." });

export async function createChallenge(_: ChallengeState, form: FormData): Promise<ChallengeState> {
  const s = (k: string) => String(form.get(k) ?? "");
  const v = draft.safeParse({ orgId: s("orgId"), title: s("title"), brief: s("brief"), prize: s("prize"), topic: s("topic"), deadline: s("deadline") });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { orgId, ...rest } = v.data;
  const { data, error } = await supabase.from("challenges").insert({ org_id: orgId, ...rest }).select("id").single();
  if (error) return { ok: false, message: error.code === "42501" ? "Only a verified company or school's admins can post challenges." : reason(error) };
  refresh(data.id);
  return { ok: true, message: "Draft saved. Sponsor it to go live.", id: data.id };
}

// Sponsoring: Stripe Checkout when it's switched on; otherwise a pilot request for a Brazework admin.
export async function sponsorChallenge(id: string): Promise<ChallengeState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data: c } = await supabase.from("challenges").select("id, org_id").eq("id", id).maybeSingle();
  if (!c) return { ok: false, message: "That challenge isn't yours to sponsor." };
  const pay = await billing().checkout({
    plan: "challenge", orgId: c.org_id, reference: c.id, email: user.email,
    successUrl: `${env.siteUrl}/challenges/${c.id}?paid=1`, cancelUrl: `${env.siteUrl}/challenges/${c.id}`,
  });
  if (pay.ok) {
    const { error } = await supabase.rpc("request_sponsorship", { p_id: id, p_provider: "stripe", p_ref: pay.ref });
    if (error) return { ok: false, message: reason(error) };
    redirect(pay.url);
  }
  if (pay.reason === "error") return { ok: false, message: pay.message };
  const { error } = await supabase.rpc("request_sponsorship", { p_id: id });
  if (error) return { ok: false, message: reason(error) };
  refresh(id);
  return { ok: true, message: "Pilot requested. The Brazework team will approve it, then you can publish." };
}

export async function publishChallenge(id: string): Promise<ChallengeState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("publish_challenge", { p_id: id });
  if (error) return { ok: false, message: reason(error) };
  refresh(id);
  return { ok: true, message: "Live. Every club on Brazework can see it now." };
}

export async function enterChallenge(_: ChallengeState, form: FormData): Promise<ChallengeState> {
  const id = String(form.get("challengeId") ?? "");
  const projectId = String(form.get("projectId") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  if (!projectId) return { ok: false, message: "Pick the project you're entering." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("challenge_entries").insert({ challenge_id: id, project_id: projectId, note });
  if (error) return { ok: false, message: error.code === "42501" ? "Entries are closed, or that project isn't yours." : reason(error) };
  refresh(id);
  return { ok: true, message: "You're in. The sponsor sees your project and its verified milestones." };
}

export async function withdrawEntry(challengeId: string, entryId: number): Promise<ChallengeState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("challenge_entries").delete().eq("id", entryId).select("id");
  if (error) return { ok: false, message: reason(error) };
  if (!data?.length) return { ok: false, message: "Entries can only be withdrawn while the challenge is open." };
  refresh(challengeId);
  return { ok: true, message: "Entry withdrawn." };
}

export async function closeChallenge(id: string): Promise<ChallengeState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("close_challenge", { p_id: id });
  if (error) return { ok: false, message: reason(error) };
  refresh(id);
  return { ok: true, message: data === "closed" ? "Winners announced." : "Entries closed. Pick your winners." };
}

export async function placeEntry(challengeId: string, entryId: number, place: number | null): Promise<ChallengeState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("place_entry", { p_entry: entryId, p_place: place });
  if (error) return { ok: false, message: reason(error) };
  refresh(challengeId);
  return { ok: true, message: place ? `Placed ${["1st", "2nd", "3rd"][place - 1]}.` : "Place cleared." };
}

// Brazework admins approve a pilot (or record a payment made outside checkout).
export async function setSponsorship(id: string, status: "pilot" | "paid" | "unpaid"): Promise<ChallengeState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("set_sponsorship", { p_id: id, p_status: status });
  if (error) return { ok: false, message: reason(error) };
  refresh(id);
  revalidatePath("/admin");
  return { ok: true, message: status === "unpaid" ? "Declined." : status === "pilot" ? "Pilot approved. The sponsor can publish now." : "Marked paid." };
}
