import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe webhook signatures (https://docs.stripe.com/webhooks#verify-manually): the
// Stripe-Signature header carries t=<unix seconds> and one or more v1=<hex HMAC-SHA256 of
// "<t>.<raw body>"> with the endpoint's signing secret. Events older than the tolerance are refused,
// so a captured request can't be replayed later. Tested in tests/stripe-webhook.test.ts.
export const TOLERANCE_S = 300;

export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(nowMs / 1000 - t) > TOLERANCE_S) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

// What a paid checkout means for Brazework: which challenge, and Stripe's reference for the session.
export type Paid = { plan: string; reference: string; sessionId: string };
export function paidCheckout(event: unknown): Paid | null {
  const e = event as { type?: string; data?: { object?: { id?: string; payment_status?: string; metadata?: Record<string, string> } } };
  const o = e?.data?.object;
  if (e?.type !== "checkout.session.completed" || o?.payment_status !== "paid" || !o.id) return null;
  const plan = o.metadata?.plan ?? "";
  const reference = o.metadata?.reference ?? "";
  if (!plan || !reference) return null;
  return { plan, reference, sessionId: o.id };
}
