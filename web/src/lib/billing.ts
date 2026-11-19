// Billing: one interface, one real provider (Stripe Checkout) and an "off" provider. Nothing is
// charged unless STRIPE_SECRET_KEY and a price ID are set in the environment; until then, sponsors
// request a pilot and a Brazework admin approves it (supabase/challenges.sql). Tested in tests/billing.test.ts.

export type Plan = "challenge" | "talent" | "plus";

export const PLANS: Record<Plan, { name: string; blurb: string; priceEnv: string; subscription: boolean }> = {
  challenge: { name: "Sponsored challenge", blurb: "Post a build challenge to every club on Brazework and meet the members who win it.", priceEnv: "STRIPE_PRICE_CHALLENGE", subscription: false },
  talent: { name: "Find builders seat", blurb: "Search members by club-verified work and message them in their Requests.", priceEnv: "STRIPE_PRICE_TALENT", subscription: true },
  // Plus for builders (lib/pricing.ts names and prices it). A student price is optional; without it,
  // students pay the one price.
  plus: { name: "Plus", blurb: "Every company that looked, and more for your record.", priceEnv: "STRIPE_PRICE_PLUS", subscription: true },
};
export const PLUS_STUDENT_PRICE_ENV = "STRIPE_PRICE_PLUS_STUDENT";

// orgId: the company paying (challenges, seats); userId: the member paying (Plus). priceEnv picks
// another price for the same plan (Plus for students).
export type CheckoutInput = { plan: Plan; orgId?: string; userId?: string; reference: string; email?: string; successUrl: string; cancelUrl: string; priceEnv?: string };
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
      const price = (input.priceEnv && env[input.priceEnv]) || env[PLANS[input.plan].priceEnv] || "";
      if (!key.startsWith("sk_") || !price) return billingOff.checkout(input);
      const sub = PLANS[input.plan].subscription;
      const body = new URLSearchParams({
        mode: sub ? "subscription" : "payment",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.reference,
        "metadata[org_id]": input.orgId ?? "",
        "metadata[user_id]": input.userId ?? "",
        "metadata[plan]": input.plan,
        "metadata[reference]": input.reference,
      });
      // A subscription carries the same metadata, so its cancellation can find who it was for.
      if (sub) for (const k of ["org_id", "user_id", "plan", "reference"] as const) body.set(`subscription_data[metadata][${k}]`, body.get(`metadata[${k}]`) ?? "");
      // An optional free trial on Plus, off unless a founder sets PLUS_TRIAL_DAYS (1 to 90).
      if (input.plan === "plus") { const d = plusTrialDays(env); if (d > 0) body.set("subscription_data[trial_period_days]", String(d)); }
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

/** Days of free trial on Plus checkout: PLUS_TRIAL_DAYS when it's a whole number from 1 to 90, otherwise none. */
export function plusTrialDays(env: Env = process.env): number {
  const n = Number(env.PLUS_TRIAL_DAYS ?? "");
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : 0;
}

/** Can Plus be bought right now? Stripe is on and Plus has a price. Until then it's a waitlist. */
export function plusOnSale(env: Env = process.env): boolean {
  return stripeProvider(env).enabled && Boolean(env[PLANS.plus.priceEnv]);
}

// Plus by the year (lib/pricing.ts PLUS.everyoneYear and .studentYear): optional Stripe prices. Without
// them, yearly isn't offered and everyone pays monthly.
export const PLUS_ANNUAL_PRICE_ENV = "STRIPE_PRICE_PLUS_ANNUAL";
export const PLUS_STUDENT_ANNUAL_PRICE_ENV = "STRIPE_PRICE_PLUS_STUDENT_ANNUAL";

/** Can Plus be bought by the year? On sale, with a yearly price set. */
export function plusYearlyOnSale(env: Env = process.env): boolean {
  return plusOnSale(env) && Boolean(env[PLUS_ANNUAL_PRICE_ENV]);
}

/** The price a member's Plus checkout uses (its env var name), or undefined for the one monthly price.
 *  A student who asks for yearly without a student yearly price gets the student monthly price, so a
 *  student never pays the full price by choosing a year. */
export function plusPriceEnv({ student, yearly }: { student: boolean; yearly: boolean }, env: Env = process.env): string | undefined {
  const set = (name: string) => (env[name] ? name : undefined);
  if (yearly) {
    const year = student ? set(PLUS_STUDENT_ANNUAL_PRICE_ENV) : set(PLUS_ANNUAL_PRICE_ENV);
    if (year) return year;
  }
  return student ? set(PLUS_STUDENT_PRICE_ENV) : undefined;
}
