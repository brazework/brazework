import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@/lib/env";
import type { PublicVerify } from "@/lib/verify-public";

// The verify page's data (supabase/verify-links.sql). Signed out on purpose: no cookies, the same
// answer for everyone, so it's cached for a minute and the page is fast for every recruiter who opens
// it. Changes that take a page down or revoke it clear the cache at once (verifyTag, lib/milestones.ts).
export const verifyTag = (id: string) => `verify:${id}`;

export async function loadVerify(id: string): Promise<PublicVerify | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id) || !env.supabaseUrl || !env.supabaseAnonKey) return null;
  cacheTag(verifyTag(id));
  const anon = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await anon.rpc("public_verify", { p_id: id });
  return (data as PublicVerify | null) ?? null;
}
