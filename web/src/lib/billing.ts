// Billing: one interface, one real provider (Stripe Checkout) and an "off" provider. Nothing is
// charged unless STRIPE_SECRET_KEY and a price ID are set in the environment; until then, sponsors
// request a pilot and a Brazework admin approves it (supabase/challenges.sql). Tested in tests/billing.test.ts.

export type Plan = "challenge" | "talent";

export const PLANS: Record<Plan, { name: string; blurb: string; priceEnv: string }> = {
  challenge: { name: "Sponsored challenge", blurb: "Post a build challenge to every club on Brazework and meet the members who win it.", priceEnv: "STRIPE_PRICE_CHALLENGE" },
  talent: { name: "Find builders seat", blurb: "Search members by club-verified work and message them in their Requests.", priceEnv: "STRIPE_PRICE_TALENT" },
};

export type CheckoutInput = { plan: Plan; orgId: string; reference: string; email?: string; successUrl: string; cancelUrl: string };
export type CheckoutResult = { ok: true; url: string; ref: string } | { ok: false; reason: "off" | "error"; message: string };

export interface BillingProvider {
  readonly name: string;
  readonly enabled: boolean;
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
}

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

export const billingOff: BillingProvider = {
  name: "off",
  enabled: false,
  async checkout() {
    return { ok: false, reason: "off", message: "Online checkout isn't switched on yet. Request a pilot and we'll set it up with you." };
  },
};

// Stripe Checkout through its REST API (form-encoded), so there's no SDK to install.
export function stripeProvider(env: Env, fetcher: Fetch = fetch): BillingProvider {
  const key = env.STRIPE_SECRET_KEY ?? "";
  return {
    name: "stripe",
    enabled: key.startsWith("sk_"),
    async checkout(input) {
      const price = env[PLANS[input.plan].priceEnv] ?? "";
      if (!key.startsWith("sk_") || !price) return billingOff.checkout(input);
      const body = new URLSearchParams({
        mode: input.plan === "talent" ? "subscription" : "payment",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.reference,
        "metadata[org_id]": input.orgId,
        "metadata[plan]": input.plan,
        "metadata[reference]": input.reference,
      });
      if (input.email) body.set("customer_email", input.email);
      try {
        const res = await fetcher("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const json = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
        if (!res.ok || !json.url || !json.id) return { ok: false, reason: "error", message: json.error?.message ?? "Checkout couldn't start. Try again." };
        return { ok: true, url: json.url, ref: json.id };
      } catch {
        return { ok: false, reason: "error", message: "Checkout couldn't start. Check your connection." };
      }
    },
  };
}

export function billing(env: Env = process.env): BillingProvider {
  const stripe = stripeProvider(env);
  return stripe.enabled ? stripe : billingOff;
}
