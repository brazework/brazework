import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Server only (the key isn't NEXT_PUBLIC_, so it never reaches the browser bundle).
// Service-role client for trusted server code that has no signed-in member (the billing webhook).
// It bypasses row-level security, so it's used only after the caller is verified (e.g. Stripe's
// signature). Vercel's Supabase integration sets SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!env.supabaseUrl || !key) return null;
  return createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
