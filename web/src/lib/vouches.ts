"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/forge";
import type { Signature } from "@/lib/signatures";
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

// ---------- Several asks at once (supabase/signer-tools.sql) ----------
export type InboxAsk = { id: number; relationship: Relationship; expires_at: string; member: string; project: string; title: string; detail: string; achieved_on: string | null; links: string[] };

/** The other asks sent to the same address as this link (empty unless the link is live or was used today). */
export async function vouchInbox(token: string): Promise<InboxAsk[]> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vouch_inbox", { p_token_hash: hash(token) });
  return error ? [] : ((data ?? []) as InboxAsk[]);
}

const many = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "That link isn't valid."),
  name: z.string().trim().max(80),
  title: z.string().trim().max(80),
  items: z.array(z.object({ id: z.number().int().positive(), vouch: z.boolean(), saw: z.string().trim().max(600), knowsFrom: z.string().trim().max(300) })).min(1, "Pick at least one.").max(20),
});

export type BatchResult = { ok: boolean; message: string; results?: { id: number; ok: boolean; message: string }[] };

/** Answer several asks from one page. Each one is checked on its own; a refused one doesn't stop the rest. */
export async function answerVouches(input: { token: string; name: string; title: string; items: { id: number; vouch: boolean; saw: string; knowsFrom: string }[] }): Promise<BatchResult> {
  const v = many.safeParse(input);
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const supabase = await createClient();
  const items = v.data.items.map((i) => ({ id: i.id, vouch: i.vouch, saw: i.saw, knows_from: i.knowsFrom }));
  const { data, error } = await supabase.rpc("answer_vouches", { p_token_hash: hash(v.data.token), p_name: v.data.name, p_title: v.data.title, p_items: items });
  if (error) return { ok: false, message: reason(error) };
  const rows = (data ?? []) as { id: number; ok: boolean; result?: string; message?: string }[];
  const results = rows.map((r) => ({ id: Number(r.id), ok: r.ok, message: r.ok ? (r.result === "vouched" ? "Vouched." : "Declined.") : r.message ?? "That one didn't go through." }));
  const done = results.filter((r) => r.ok).length;
  return { ok: done > 0, results, message: done === results.length ? `Done: ${done} answered. Thank you.` : `${done} of ${results.length} answered. The rest say why below.` };
}

// ---------- What you've signed ----------
export async function mySignatures() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { data, error } = await supabase.rpc("my_signatures");
  return error ? null : ((data ?? []) as Signature[]);
}
