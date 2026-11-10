import { NextResponse } from "next/server";
import { paidCheckout, verifyStripeSignature } from "@/lib/stripe-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe calls this when a checkout finishes. A paid challenge sponsorship lets the sponsor publish.
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
  const paid = paidCheckout(event);
  if (!paid) return NextResponse.json({ received: true, ignored: true });

  if (paid.plan === "challenge") {
    const { error } = await db.from("challenges").update({ sponsorship: "paid" }).eq("id", paid.reference).neq("sponsorship", "paid");
    if (error) return NextResponse.json({ error: "Couldn't record the payment." }, { status: 500 });
    await db.from("billing_requests").update({ status: "paid" }).eq("challenge_id", paid.reference).in("status", ["requested", "checkout"]);
  }
  return NextResponse.json({ received: true });
}
