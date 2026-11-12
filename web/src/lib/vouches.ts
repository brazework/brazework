"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/forge";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getViewer } from "@/lib/supabase/server";
import { buildVouchEmail, RELATIONSHIPS, type Relationship } from "@/lib/vouch-email";

// Vouches (supabase/vouches.sql, Linear FIX-94): proof without a club. The database decides who may
// ask and what a vouch needs; these actions make the link, email it, and turn errors into sentences.
// The raw link token exists only here and in the email: the database keeps its sha256, and the member
// never sees the link (they could vouch for themselves with it).

export type VouchState = { ok: boolean; message: string };
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" ? e.message ?? friendlyError(e) : friendlyError(e));
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const ask = z.object({
  milestoneId: z.string().min(1).max(64),
  email: z.string().trim().toLowerCase().email("Enter their email address.").max(254),
  relationship: z.enum(Object.keys(RELATIONSHIPS) as [Relationship, ...Relationship[]], { message: "Pick how they know your work." }),
});

export async function requestVouch(milestoneId: string, email: string, relationship: string): Promise<VouchState> {
  const v = ask.safeParse({ milestoneId, email, relationship });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const mail = mailer();
  if (!mail.enabled) return { ok: false, message: "Email isn't available right now, so we can't send the ask. Try again later." };

  const token = randomBytes(32).toString("base64url");
  const { data: id, error } = await supabase.rpc("request_vouch", { p_milestone: v.data.milestoneId, p_email: v.data.email, p_relationship: v.data.relationship, p_token_hash: hash(token) });
  if (error) return { ok: false, message: error.code === "42501" ? "You can only ask about your own milestones." : reason(error) };

  const [{ data: me }, { data: m }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.from("milestones").select("title, project_id").eq("id", v.data.milestoneId).maybeSingle(),
  ]);
  const { data: project } = m ? await supabase.from("projects").select("title").eq("id", m.project_id).maybeSingle() : { data: null };
  const sent = await mail.send({
    to: v.data.email,
    ...buildVouchEmail({
      member: `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim(), title: m?.title ?? "A milestone", project: project?.title ?? "",
      relationship: v.data.relationship, link: `${env.siteUrl}/vouch/${token}`,
    }),
  });
  if (!sent.ok) {
    // Nobody can answer an ask whose email never went out: close it so it doesn't hold a slot.
    await createAdminClient()?.from("milestone_vouches").update({ state: "withdrawn" }).eq("id", id);
    return { ok: false, message: "We couldn't send the email. Check the address and try again." };
  }
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: `Asked. We emailed ${v.data.email}; you'll be notified when they answer.` };
}

const answer = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "That link isn't valid."),
  vouch: z.boolean(),
  name: z.string().trim().max(80),
  title: z.string().trim().max(80),
  saw: z.string().trim().max(600),
  knowsFrom: z.string().trim().max(300),
});

export async function answerVouch(input: { token: string; vouch: boolean; name: string; title: string; saw: string; knowsFrom: string }): Promise<VouchState> {
  const v = answer.safeParse(input);
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const supabase = await createClient();
  const d = v.data;
  const { data, error } = await supabase.rpc("answer_vouch", { p_token_hash: hash(d.token), p_vouch: d.vouch, p_name: d.name, p_title: d.title, p_saw: d.saw, p_knows_from: d.knowsFrom });
  if (error) return { ok: false, message: reason(error) };
  return { ok: true, message: data === "vouched" ? "Thank you. Your vouch is on their record, with your name on it." : "Done. We've let them know, and nothing was added to their record." };
}

/** For the vouch page: what the link is about (null when it isn't a live link). */
export async function previewVouch(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("vouch_preview", { p_token_hash: hash(token) });
  return (data ?? null) as null | {
    state: "asked" | "vouched" | "declined" | "expired" | "withdrawn"; email: string; relationship: Relationship; member: string; project: string;
    title: string; detail: string; evidence: string; evidence_items: { type: string; url?: string }[]; achieved_on: string | null; expires_at: string;
  };
}
