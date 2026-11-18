import { connection } from "next/server";
import { env } from "@/lib/env";
import { enabledFrom, type ProviderId } from "@/lib/oauth";

// Which "Continue with ..." buttons to show: the providers switched on in Supabase (Authentication →
// Sign In / Providers), read from Supabase Auth's public settings. A provider appears once a founder
// turns it on, with no deploy, and never shows as a button that fails. Remembered for five minutes
// per server; if Supabase can't be asked just now, no buttons (the email form always works).
const TTL = 5 * 60 * 1000;
let memo: { at: number; ids: ProviderId[] } | null = null;

export async function enabledProviders(): Promise<ProviderId[]> {
  // Per request (it reads the clock), so prerendering leaves it to request time.
  await connection();
  if (memo && Date.now() - memo.at < TTL) return memo.ids;
  if (!env.supabaseUrl || !env.supabaseAnonKey) return [];
  try {
    const r = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey }, cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!r.ok) return memo?.ids ?? [];
    memo = { at: Date.now(), ids: enabledFrom(await r.json()) };
    return memo.ids;
  } catch {
    return memo?.ids ?? [];
  }
}
