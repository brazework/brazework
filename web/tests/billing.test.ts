// Billing never charges without real keys, and Stripe gets exactly what it needs. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { PLUS_STUDENT_PRICE_ENV, billing, plusOnSale, stripeProvider, type CheckoutInput } from "@/lib/billing";

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

test("Plus: a subscription for the member, with the student price when there is one, and metadata on the subscription", async () => {
  let sent: URLSearchParams | undefined;
  const env = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PLUS: "price_plus", STRIPE_PRICE_PLUS_STUDENT: "price_plus_student" };
  const s = stripeProvider(env, async (_url, init) => { sent = init.body as URLSearchParams; return { ok: true, json: async () => ({ id: "cs_p", url: "https://checkout.stripe.com/c/cs_p" }) }; });
  const r = await s.checkout({ plan: "plus", userId: "u1", reference: "u1", priceEnv: PLUS_STUDENT_PRICE_ENV, successUrl: "https://forge.test/plus?welcome=1", cancelUrl: "https://forge.test/plus" });
  assert.equal(r.ok, true);
  assert.equal(sent?.get("mode"), "subscription");
  assert.equal(sent?.get("line_items[0][price]"), "price_plus_student");
  assert.equal(sent?.get("metadata[user_id]"), "u1");
  assert.equal(sent?.get("subscription_data[metadata][user_id]"), "u1");
  assert.equal(sent?.get("subscription_data[metadata][plan]"), "plus");
  await s.checkout({ plan: "plus", userId: "u2", reference: "u2", successUrl: "https://forge.test/a", cancelUrl: "https://forge.test/b" });
  assert.equal(sent?.get("line_items[0][price]"), "price_plus", "no student price asked for: the one price");
  await stripeProvider({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PLUS: "price_plus" }, async (_u, init) => { sent = init.body as URLSearchParams; return { ok: true, json: async () => ({ id: "x", url: "https://checkout.stripe.com/x" }) }; })
    .checkout({ plan: "plus", userId: "u3", reference: "u3", priceEnv: PLUS_STUDENT_PRICE_ENV, successUrl: "https://forge.test/a", cancelUrl: "https://forge.test/b" });
  assert.equal(sent?.get("line_items[0][price]"), "price_plus", "no student price set: students pay the one price");
});

test("Plus is on sale only with a Stripe key and a Plus price; a challenge stays a one-time payment", async () => {
  assert.equal(plusOnSale({}), false);
  assert.equal(plusOnSale({ STRIPE_SECRET_KEY: "sk_test_x" }), false);
  assert.equal(plusOnSale({ STRIPE_PRICE_PLUS: "price_plus" }), false);
  assert.equal(plusOnSale({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PLUS: "price_plus" }), true);
  let sent: URLSearchParams | undefined;
  await stripeProvider({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_CHALLENGE: "price_1" }, async (_u, init) => { sent = init.body as URLSearchParams; return { ok: true, json: async () => ({ id: "x", url: "https://checkout.stripe.com/x" }) }; }).checkout(input);
  assert.equal(sent?.get("mode"), "payment");
  assert.equal(sent?.has("subscription_data[metadata][plan]"), false);
});

test("Plus trial: off unless a founder sets PLUS_TRIAL_DAYS, and only on Plus", async () => {
  const { plusTrialDays } = await import("@/lib/billing");
  assert.equal(plusTrialDays({}), 0);
  for (const bad of ["0", "-3", "91", "7.5", "seven", ""]) assert.equal(plusTrialDays({ PLUS_TRIAL_DAYS: bad }), 0, bad);
  assert.equal(plusTrialDays({ PLUS_TRIAL_DAYS: "30" }), 30);
  let sent: URLSearchParams | undefined;
  const fetcher = async (_u: string, init: { body?: unknown }) => { sent = init.body as URLSearchParams; return { ok: true, json: async () => ({ id: "x", url: "https://checkout.stripe.com/x" }) }; };
  const env = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PLUS: "price_plus", STRIPE_PRICE_TALENT: "price_t", PLUS_TRIAL_DAYS: "30" };
  await stripeProvider(env, fetcher as never).checkout({ plan: "plus", userId: "u1", reference: "u1", successUrl: "https://forge.test/a", cancelUrl: "https://forge.test/b" });
  assert.equal(sent?.get("subscription_data[trial_period_days]"), "30");
  await stripeProvider(env, fetcher as never).checkout({ plan: "talent", orgId: "o1", reference: "o1", successUrl: "https://forge.test/a", cancelUrl: "https://forge.test/b" });
  assert.equal(sent?.get("subscription_data[trial_period_days]"), null, "company seats never get it");
  await stripeProvider({ ...env, PLUS_TRIAL_DAYS: "" }, fetcher as never).checkout({ plan: "plus", userId: "u2", reference: "u2", successUrl: "https://forge.test/a", cancelUrl: "https://forge.test/b" });
  assert.equal(sent?.get("subscription_data[trial_period_days]"), null, "no setting, no trial");
});
