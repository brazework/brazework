"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

// One browser client per tab, shared by every component (used for Realtime).
export function getBrowserClient() {
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
