import { EMBER_INSUFFICIENT, EMBER_UNAVAILABLE, type EmberAction } from "@/lib/ember-credits";
import type { getViewer } from "@/lib/supabase/server";

type Database = Awaited<ReturnType<typeof getViewer>>["supabase"];

export async function takeEmberCredits(db: Database, action: EmberAction) {
  let { data, error } = await db.rpc("ember_take", { p_action: action });
  // The previous RPC still charges exactly one credit for a standard ask during rollout.
  if (error?.code === "PGRST202" && action === "ask") {
    ({ data, error } = await db.rpc("copilot_take"));
  }
  if (error || typeof data !== "number") return { ok: false, status: 503, message: EMBER_UNAVAILABLE } as const;
  if (data < 0) return { ok: false, status: 429, message: EMBER_INSUFFICIENT } as const;
  return { ok: true, remaining: data } as const;
}
