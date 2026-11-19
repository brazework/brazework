"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PLUS_STUDENT_PRICE_ENV, billing, plusOnSale } from "@/lib/billing";
import { dbFeatures } from "@/lib/db-features";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/forge";
import { SALES_KINDS } from "@/lib/pricing";
import { getViewer } from "@/lib/supabase/server";

// Money paths (supabase/money.sql, lib/pricing.ts): Plus for builders, search seats for verified
// companies, and requests (a pilot, sponsoring a chapter or a challenge, a school's demo) that land in
// the founders' admin queue. Stripe Checkout through lib/billing.ts when its keys and prices are set;
// until then, a request the founders answer. Nobody types an email address: requests carry the
// member's account email.

export type MoneyState = { ok: boolean; message: string };
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" || e.code === "42501" ? e.message ?? friendlyError(e) : friendlyError(e));


/** Plus: Stripe Checkout when it's on sale, otherwise a place on the waitlist. */
export async function startPlus(): Promise<MoneyState> {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login?next=/plus");
  if (!(await dbFeatures()).money) return { ok: false, message: "Plus isn't open yet. Try again soon." };
  const { data: has } = await supabase.rpc("has_plus");
  if (has) return { ok: true, message: "You already have Plus." };
  if (plusOnSale()) {
    const pay = await billing().checkout({
      plan: "plus", userId: user.id, reference: user.id, email: user.email,
      priceEnv: profile.account_type === "student" ? PLUS_STUDENT_PRICE_ENV : undefined,
      successUrl: `${env.siteUrl}/plus?welcome=1`, cancelUrl: `${env.siteUrl}/plus`,
    });
    if (pay.ok) redirect(pay.url);
    if (pay.reason === "error") return { ok: false, message: pay.message };
  }
  const { data, error } = await supabase.rpc("request_sales", { p_kind: "plus", p_org: "", p_club: "", p_note: "" });
  if (error) return { ok: false, message: reason(error) };
  return { ok: true, message: data === "already" ? "You're already on the Plus waitlist. We'll email you when it opens." : `You're on the Plus waitlist. We'll email ${user.email ?? "you"} when it opens, at the launch price.` };
}

const ask = z.object({
  kind: z.enum(SALES_KINDS, { error: "Pick what you'd like." }),
  org: z.string().trim().max(120),
  club: z.string().trim().max(64).regex(/^[A-Za-z0-9-]*$/),
  note: z.string().trim().max(500, "Keep the note under 500 characters."),
});

/** A request for the founders: a pilot, a sponsorship, a demo. Lands in the admin queue. */
export async function requestSales(_: MoneyState, form: FormData): Promise<MoneyState> {
  const v = ask.safeParse({ kind: form.get("kind"), org: form.get("org") ?? "", club: form.get("club") ?? "", note: form.get("note") ?? "" });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in first, so we know where to reply." };
  if (!(await dbFeatures()).money) return { ok: false, message: "Requests aren't open yet. Try again soon." };
  const { data, error } = await supabase.rpc("request_sales", { p_kind: v.data.kind, p_org: v.data.org, p_club: v.data.club, p_note: v.data.note });
  if (error) return { ok: false, message: reason(error) };
  return { ok: true, message: data === "already" ? "We have this one already. We'll be in touch soon." : `Requested. Josh or Ian will reply to ${user.email ?? "your account email"} within a day.` };
}

/** Search seats for a verified company's admin: Stripe Checkout when it's on, otherwise a pilot request. */
export async function startSeats(): Promise<MoneyState> {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login?next=/talent");
  const { data: adm } = await supabase.from("organization_admins").select("org_id, organizations(id, name, type, verification_status)").eq("uid", user.id).limit(10);
  type Row = { org_id: string; organizations: { id: string; name: string; type: string; verification_status: string } | null };
  const org = ((adm ?? []) as unknown as Row[]).map((r) => r.organizations).find((o) => o?.type === "company" && o.verification_status === "verified");
  if (!org) return { ok: false, message: "Search seats are for verified companies. Register yours under Organization first." };
  const pay = await billing().checkout({
    plan: "talent", orgId: org.id, userId: user.id, reference: org.id, email: user.email,
    successUrl: `${env.siteUrl}/talent?seats=1`, cancelUrl: `${env.siteUrl}/talent`,
  });
  if (pay.ok) redirect(pay.url);
  if (pay.reason === "error") return { ok: false, message: pay.message };
  const { data, error } = await supabase.rpc("request_sales", { p_kind: "talent", p_org: org.name, p_club: "", p_note: "Search seats, from Find builders" });
  if (error) return { ok: false, message: reason(error) };
  return { ok: true, message: data === "already" ? "We have your request. We'll be in touch soon." : `Pilot requested for ${org.name}. Josh or Ian will reply to ${user.email ?? "your account email"} within a day.` };
}
