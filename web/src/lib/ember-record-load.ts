import { dbFeatures } from "@/lib/db-features";
import { EMPTY_RECORD, newestFirst, type EmberRecord, type OpenMilestone } from "@/lib/ember-record";
import { requestTime } from "@/lib/forge";
import { isGoalKind, type GoalKind } from "@/lib/goals";
import { loadRecentWork } from "@/lib/recent-work-load";
import type { createClient } from "@/lib/supabase/server";

// Server only: a member's record for Torch (lib/ember-record.ts), read with the member's own client,
// so row-level security decides what is seen. It only reads. Every part fails soft: a table that
// isn't there yet or a slow lookup leaves that part empty, and Torch still answers.

type DB = Awaited<ReturnType<typeof createClient>>;
const PROVEN = ["verified", "logged"];
const OPEN = ["draft", "pending"];

/**
 * `withGitHub`: also count the member's merged pull requests that aren't on the record. That asks
 * GitHub, so it is for a page load (Torch's page), not for every question to Torch.
 */
export async function loadEmberRecord(db: DB, userId: string, accountType: string | null | undefined, { withGitHub = false }: { withGitHub?: boolean } = {}): Promise<EmberRecord> {
  const student = accountType !== "professional";
  try {
    const f = await dbFeatures();
    const now = requestTime();
    const [projects, ms, asks, linkedin, goals] = await Promise.all([
      db.from("projects").select("id, title").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
      f.milestones ? db.from("milestones").select("id, project_id, title, status, community_id, achieved_on").eq("owner_id", userId).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
      f.milestones ? db.from("milestone_vouches").select("milestone_id, email, created_at").eq("state", "asked").gt("expires_at", new Date(now).toISOString()).order("created_at", { ascending: true }).limit(60) : Promise.resolve({ data: [] }),
      !student && f.linkedinRequired ? db.rpc("needs_linkedin") : Promise.resolve({ data: false }),
      // What they're working toward (supabase/goals.sql); null when they haven't set one, undefined if
      // the table isn't there or the read failed (then Torch neither offers nor assumes a goal).
      f.goals ? db.from("member_goals").select("kind, target").eq("uid", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: null, error: null }),
    ]);
    const mine = ((projects.data ?? []) as { id: string; title: string }[]);
    const rows = ((ms.data ?? []) as { id: string; project_id: string; title: string; status: string; community_id: string | null; achieved_on?: string | null }[]);
    const asked = ((asks.data ?? []) as { milestone_id: string; email: string; created_at: string }[]);
    const open: OpenMilestone[] = newestFirst(rows.filter((m) => OPEN.includes(m.status)).map((m) => ({
      id: m.id, title: m.title, project_id: m.project_id, club: Boolean(m.community_id), on: m.achieved_on ?? "",
      asked: asked.filter((a) => a.milestone_id === m.id).map((a) => ({ email: a.email, days: Math.max(0, Math.floor((now - new Date(a.created_at).getTime()) / 86400000)) })),
    }))).slice(0, 12);
    const ids = mine.map((p) => p.id);
    const { data: repoRows } = ids.length ? await db.from("project_repos").select("project_id, full_name").in("project_id", ids).limit(20) : { data: [] };
    const repos = (repoRows ?? []) as { project_id: string; full_name: string }[];
    let unlogged: EmberRecord["unlogged"] = null;
    if (withGitHub && repos.length) {
      // The newest project with a linked repo; a slow GitHub never holds the page.
      const projectId = ids.find((id) => repos.some((r) => r.project_id === id))!;
      const work = await Promise.race([loadRecentWork(projectId, userId), new Promise<[]>((ok) => setTimeout(() => ok([]), 2500))]);
      if (work.length) unlogged = { project_id: projectId, count: work.length };
    }
    const g = ((goals.data ?? []) as { kind: string; target: string }[]).find((x) => isGoalKind(x.kind));
    const goal: EmberRecord["goal"] = goals.error || goals.data === null ? undefined : g ? { kind: g.kind as GoalKind, target: g.target ?? "" } : null;
    return { student, needsLinkedin: linkedin.data === true, projects: mine, open, proven: rows.filter((m) => PROVEN.includes(m.status)).length, repos: [...new Set(repos.map((r) => r.full_name))], unlogged, goal };
  } catch {
    return { ...EMPTY_RECORD, student };
  }
}
