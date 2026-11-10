// Telling "you're signed out" apart from "we couldn't check just now". A missing or invalid session
// means signed out. A network failure, a 5xx or a rate limit from Supabase Auth is temporary, and
// must not sign anyone out: under load that turned busy moments into members bounced to /login
// (found by the load test, e2e/load.js; Linear FIX-32).
export function isTemporaryAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status } = error as { name?: string; status?: number };
  if (name === "AuthRetryableFetchError") return true;
  const code = Number(status ?? 0);
  return code === 429 || code >= 500;
}
