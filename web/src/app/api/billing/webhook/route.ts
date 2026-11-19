import { NextResponse } from "next/server";
import { endedSubscription, paidCheckout, verifyStripeSignature } from "@/lib/stripe-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe calls this when a checkout finishes. A paid challenge sponsorship lets the sponsor publish;
// a paid Plus checkout gives the member Plus (supabase/money.sql), and its subscription ending takes it away.
// Set STRIPE_WEBHOOK_SECRET (the endpoint's signing secret) and SUPABASE_SERVICE_ROLE_KEY. Safe to
// receive the same event twice.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const db = createAdminClient();
  if (!secret || !db) return NextResponse.json({ error: "Billing webhook isn't configured." }, { status: 503 });
  const body = await req.text();
  if (!verifyStripeSignature(body, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }
  let event: unknown;
  try { event = JSON.parse(body); } catch { return NextResponse.json({ error: "Bad JSON." }, { status: 400 }); }
  const ended = endedSubscription(event);
  if (ended?.plan === "plus") {
    const { error } = await db.from("member_plans").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("user_id", ended.userId);
    return error ? NextResponse.json({ error: "Couldn't record the cancellation." }, { status: 500 }) : NextResponse.json({ received: true });
  }
  const paid = paidCheckout(event);
  if (!paid) return NextResponse.json({ received: true, ignored: true });

  if (paid.plan === "plus" && /^[0-9a-f-]{36}$/i.test(paid.userId)) {
    const { error } = await db.from("member_plans").upsert({ user_id: paid.userId, plan: "plus", status: "active", provider: "stripe", provider_ref: paid.subscriptionId || paid.sessionId, current_period_end: null, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Couldn't record Plus." }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  // Search seats for a verified company: recorded for the founders (admin metrics read billing_requests).
  if (paid.plan === "talent") {
    const { error } = await db.from("billing_requests").insert({ org_id: paid.reference, plan: "talent", status: "paid", provider: "stripe", provider_ref: paid.subscriptionId || paid.sessionId, requested_by: /^[0-9a-f-]{36}$/i.test(paid.userId) ? paid.userId : null });
    if (error) return NextResponse.json({ error: "Couldn't record the seats." }, { status: 500 });
    return NextResponse.json({ received: true });
  }
  if (paid.plan === "challenge") {
    const { error } = await db.from("challenges").update({ sponsorship: "paid" }).eq("id", paid.reference).neq("sponsorship", "paid");
    if (error) return NextResponse.json({ error: "Couldn't record the payment." }, { status: 500 });
    await db.from("billing_requests").update({ status: "paid" }).eq("challenge_id", paid.reference).in("status", ["requested", "checkout"]);
  }
  return NextResponse.json({ received: true });
}
