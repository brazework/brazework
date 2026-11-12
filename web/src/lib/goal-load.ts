import type { createClient } from "@/lib/supabase/server";
import { isGoalKind, type Goal, type Record_ } from "@/lib/goals";

// Loading a member's goal and the record its path is built from (lib/goals.ts). Row-level security
// decides what's visible: another member's hidden goal simply doesn't come back.
type DB = Awaited<ReturnType<typeof createClient>>;

/** Their active goal, or the last one they reached (shown as a result), or null. */
export async function loadGoal(supabase: DB, uid: string): Promise<Goal | null> {
  const { data } = await supabase.from("member_goals").select("id, kind, target, visible, status, met_note, created_at, closed_at")
    .eq("uid", uid).in("status", ["active", "met"]).order("created_at", { ascending: false }).limit(3);
  const rows = ((data ?? []) as Goal[]).filter((g) => isGoalKind(g.kind));
  return rows.find((g) => g.status === "active") ?? rows.find((g) => g.status === "met") ?? null;
}

/** Your own record for the path: projects, milestones signed and waiting, who looked this month. */
export async function loadRecord(supabase: DB, uid: string): Promise<Record_> {
  const [projects, signed, waiting, viewers] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", uid),
    supabase.from("milestones").select("id", { count: "exact", head: true }).eq("owner_id", uid).eq("status", "verified"),
    supabase.from("milestones").select("id", { count: "exact", head: true }).eq("owner_id", uid).eq("status", "pending"),
    supabase.rpc("my_viewers", { p_days: 30 }),
  ]);
  const looked = Number((viewers.data as { total?: number } | null)?.total ?? 0);
  return { projects: projects.count ?? 0, signed: signed.count ?? 0, waiting: waiting.count ?? 0, looked: Number.isFinite(looked) ? looked : 0 };
}
