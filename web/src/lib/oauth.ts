// Sign-in with Google, GitHub or LinkedIn (Supabase Auth). Plain functions, no server imports, so
// tests can load them. The flow: a provider button is a link to /auth/oauth (route.ts there starts
// it), the provider sends the person to Supabase, Supabase to /auth/callback with ?code=, and a
// newcomer finishes sign-up in onboarding (supabase/oauth-signup.sql, finish_signup()).

// In the order the buttons show. `id` is Supabase's provider name.
export const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "linkedin_oidc", label: "LinkedIn" },
] as const;
export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const isProvider = (v: unknown): v is ProviderId => PROVIDERS.some((p) => p.id === v);
export const providerLabel = (id: string | undefined | null) => PROVIDERS.find((p) => p.id === id)?.label ?? "your sign-in provider";

// Which providers are switched on, from Supabase Auth's public /auth/v1/settings ("external": {...}).
// Anything unexpected means none: no button beats a button that fails.
export function enabledFrom(settings: unknown): ProviderId[] {
  const ext = (settings as { external?: Record<string, unknown> } | null)?.external;
  if (!ext || typeof ext !== "object") return [];
  return PROVIDERS.filter((p) => ext[p.id] === true).map((p) => p.id);
}

// Only same-site paths, so ?next= can't send anyone to another website.
export const safeNext = (v: unknown, fallback = "/feed") => (typeof v === "string" && /^\/(?!\/)/.test(v) && !v.includes("\\") ? v : fallback);

// Where a sign-in started, so an error goes back there.
export const fromPage = (v: unknown): "login" | "signup" => (v === "signup" ? "signup" : "login");

// Supabase's own callback URL for this provider round-trip: /auth/callback, told where to go next.
export function callbackUrl(origin: string, next: string, from: "login" | "signup") {
  const u = new URL("/auth/callback", origin);
  u.searchParams.set("flow", "oauth");
  u.searchParams.set("from", from);
  if (next !== "/feed") u.searchParams.set("next", next);
  return u.toString();
}

// What went wrong on the way back, as a short code for ?oauth= on the login or sign-up page.
export type OAuthProblem = "cancelled" | "unverified" | "no-email" | "expired" | "failed" | "unavailable";
export function oauthProblem(params: URLSearchParams): OAuthProblem | null {
  const error = params.get("error") ?? "";
  const desc = `${params.get("error_code") ?? ""} ${params.get("error_description") ?? ""}`.toLowerCase();
  if (!error && !desc.trim()) return null;
  if (/unverified email|email.*not.*(verified|confirmed)|confirmation email/.test(desc)) return "unverified";
  if (/error getting user email|no email|email.*(missing|required)/.test(desc)) return "no-email";
  if (/provider is not enabled|unsupported provider/.test(desc)) return "unavailable";
  if (error === "access_denied" || /cancel|denied/.test(desc)) return "cancelled";
  return "failed";
}

export function oauthMessage(code: unknown): string {
  switch (code) {
    case "cancelled": return "Sign-in was cancelled. Try again, or use your email.";
    case "unverified": return "Your account there has an unconfirmed email. We sent a link to it: open it, then try again.";
    case "no-email": return "That account didn't share an email address. Make one public or primary there, or use your email.";
    case "expired": return "That sign-in expired. Start it again in this browser.";
    case "unavailable": return "That sign-in option isn't available right now. Use your email.";
    case "failed": return "That sign-in didn't work. Try again, or use your email.";
    default: return "";
  }
}

// First and last name from what the provider shared, to start the finish-sign-up form with.
// Google and LinkedIn send given_name and family_name; GitHub only a display name (or nothing).
export function namesFrom(meta: unknown): { firstName: string; lastName: string } {
  const m = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === "string" ? (m[k] as string).trim() : "");
  const cut = (s: string) => s.slice(0, 80);
  if (str("given_name") || str("family_name")) return { firstName: cut(str("given_name")), lastName: cut(str("family_name")) };
  const full = (str("full_name") || str("name")).replace(/\s+/g, " ");
  if (!full || full.includes("@")) return { firstName: "", lastName: "" };
  const at = full.lastIndexOf(" ");
  return at < 0 ? { firstName: cut(full), lastName: "" } : { firstName: cut(full.slice(0, at)), lastName: cut(full.slice(at + 1)) };
}
