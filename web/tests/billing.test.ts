// Billing never charges without real keys, and Stripe gets exactly what it needs. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { billing, stripeProvider, type CheckoutInput } from "@/lib/billing";

const input: CheckoutInput = { plan: "challenge", orgId: "org1", reference: "ch1", successUrl: "https://forge.test/ok", cancelUrl: "https://forge.test/no" };

test("with no keys, billing is off and checkout says so", async () => {
  const b = billing({});
  assert.equal(b.enabled, false);
  const r = await b.checkout(input);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "off");
});

test("a key without a price for the plan doesn't call Stripe", async () => {
  let called = false;
  const s = stripeProvider({ STRIPE_SECRET_KEY: "sk_test_x" }, async () => { called = true; return { ok: true, json: async () => ({}) }; });
  const r = await s.checkout(input);
  assert.equal(called, false);
  assert.equal(r.ok === false && r.reason, "off");
});

test("Stripe Checkout gets the price, the org and the reference; the session URL comes back", async () => {
  let sent: URLSearchParams | undefined;
  let auth = "";
  const s = stripeProvider({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_CHALLENGE: "price_1" }, async (url, init) => {
    assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
    sent = init.body as URLSearchParams;
    auth = (init.headers as Record<string, string>).Authorization;
    return { ok: true, json: async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" }) };
  });
  const r = await s.checkout(input);
  assert.deepEqual(r, { ok: true, url: "https://checkout.stripe.com/c/cs_1", ref: "cs_1" });
  assert.equal(auth, "Bearer sk_test_x");
  assert.equal(sent?.get("mode"), "payment");
  assert.equal(sent?.get("line_items[0][price]"), "price_1");
  assert.equal(sent?.get("metadata[org_id]"), "org1");
  assert.equal(sent?.get("client_reference_id"), "ch1");
});

test("a Stripe error is reported, not swallowed", async () => {
  const s = stripeProvider({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_CHALLENGE: "price_1" }, async () => ({ ok: false, json: async () => ({ error: { message: "No such price" } }) }));
  const r = await s.checkout(input);
  assert.equal(r.ok === false && r.message, "No such price");
});
