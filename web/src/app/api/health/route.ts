import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// For an uptime monitor (Linear FIX-55): 200 when the app can reach its database, 503 when it
// can't. The check is public_stats(), the landing page's anonymous counts, with a 5 s limit, so it
// reads nothing private and costs one small query. Never cached.
export async function GET() {
  const started = Date.now();
  let db: "ok" | "down" = "down";
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("public_stats").abortSignal(AbortSignal.timeout(5000));
    if (!error) db = "ok";
  } catch {}
  const ok = db === "ok";
  return NextResponse.json(
    { ok, db, ms: Date.now() - started, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
