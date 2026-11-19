// The billing webhook only believes Stripe: right secret, fresh timestamp, untouched body. Run: npm test
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { endedSubscription, paidCheckout, verifyStripeSignature } from "@/lib/stripe-webhook";

const secret = "whsec_test";
const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", metadata: { plan: "challenge", reference: "ch1" } } } });
const now = 1_800_000_000_000;
const sign = (t: number, payload = body, key = secret) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")}`;

test("a correctly signed, fresh event is accepted", () => {
  assert.equal(verifyStripeSignature(body, sign(now / 1000), secret, now), true);
});

test("wrong secret, edited body, stale timestamp or no header are refused", () => {
  assert.equal(verifyStripeSignature(body, sign(now / 1000, body, "whsec_other"), secret, now), false);
  assert.equal(verifyStripeSignature(body.replace("ch1", "ch2"), sign(now / 1000), secret, now), false);
  assert.equal(verifyStripeSignature(body, sign(now / 1000 - 600), secret, now), false);
  assert.equal(verifyStripeSignature(body, null, secret, now), false);
  assert.equal(verifyStripeSignature(body, "t=abc,v1=00", secret, now), false);
});

test("any one matching v1 signature is enough (Stripe rotates secrets)", () => {
  const t = now / 1000;
  assert.equal(verifyStripeSignature(body, `t=${t},v1=deadbeef,${sign(t).split(",")[1]}`, secret, now), true);
});

test("only paid checkouts with Brazework metadata count", () => {
  assert.deepEqual(paidCheckout(JSON.parse(body)), { plan: "challenge", reference: "ch1", sessionId: "cs_1", userId: "", subscriptionId: "" });
  assert.equal(paidCheckout({ type: "checkout.session.completed", data: { object: { id: "cs_2", payment_status: "unpaid", metadata: { plan: "challenge", reference: "ch1" } } } }), null);
  assert.equal(paidCheckout({ type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } }), null);
  assert.equal(paidCheckout({ type: "checkout.session.completed", data: { object: { id: "cs_3", payment_status: "paid", metadata: {} } } }), null);
});

test("a paid Plus checkout says whose it is and its subscription; an ended one is found by its metadata", () => {
  const uid = "11111111-2222-3333-4444-555555555555";
  assert.deepEqual(paidCheckout({ type: "checkout.session.completed", data: { object: { id: "cs_9", payment_status: "paid", subscription: "sub_9", metadata: { plan: "plus", reference: uid, user_id: uid } } } }),
    { plan: "plus", reference: uid, sessionId: "cs_9", userId: uid, subscriptionId: "sub_9" });
  assert.deepEqual(endedSubscription({ type: "customer.subscription.deleted", data: { object: { id: "sub_9", metadata: { plan: "plus", user_id: uid } } } }), { plan: "plus", userId: uid, subscriptionId: "sub_9" });
  assert.equal(endedSubscription({ type: "customer.subscription.deleted", data: { object: { id: "sub_8", metadata: {} } } }), null);
  assert.equal(endedSubscription({ type: "customer.subscription.updated", data: { object: { id: "sub_9", metadata: { plan: "plus", user_id: uid } } } }), null);
});
