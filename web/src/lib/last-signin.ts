// How someone last logged in on this device, so the log-in page can mark it "Last used" and fill in
// their email. Kept in this browser only (localStorage), never sent anywhere; "Use a different
// account" forgets it. Every read and write is wrapped: private windows and blocked storage just
// mean nothing is remembered.
import { isProvider, type ProviderId } from "@/lib/oauth";
import { EMAIL_RE } from "@/lib/forge";

export const LAST_SIGNIN_KEY = "brazework-last-signin";
export type SignInMethod = "password" | "code" | ProviderId;
export type LastSignIn = { method: SignInMethod; email?: string };

export function parseLastSignIn(raw: string | null | undefined): LastSignIn | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { method?: unknown; email?: unknown };
    const method = v.method === "password" || v.method === "code" || isProvider(v.method) ? (v.method as SignInMethod) : null;
    if (!method) return null;
    const email = typeof v.email === "string" && EMAIL_RE.test(v.email) && v.email.length <= 254 ? v.email : undefined;
    return email ? { method, email } : { method };
  } catch {
    return null;
  }
}

export function readLastSignIn(): LastSignIn | null {
  try { return parseLastSignIn(localStorage.getItem(LAST_SIGNIN_KEY)); } catch { return null; }
}
export function saveLastSignIn(v: LastSignIn) {
  try { localStorage.setItem(LAST_SIGNIN_KEY, JSON.stringify(v)); } catch {}
}
export function forgetLastSignIn() {
  try { localStorage.removeItem(LAST_SIGNIN_KEY); } catch {}
}
