import { dbFeatures } from "@/lib/db-features";
import { EMPTY_RECORD, type EmberRecord, type OpenMilestone } from "@/lib/ember-record";
import { requestTime } from "@/lib/forge";
import { loadRecentWork } from "@/lib/recent-work-load";
import type { createClient } from "@/lib/supabase/server";

// Server only: a member's record for Ember (lib/ember-record.ts), read with the member's own client,
// so row-level security decides what is seen. It only reads. Every part fails soft: a table that
// isn't there yet or a slow lookup leaves that part empty, and Ember still answers.

type DB = Awaited<ReturnType<typeof createClient>>;
const PROVEN = ["verified", "logged"];
const OPEN = ["draft", "pending"];

/**
 * `withGitHub`: also count the member's merged pull requests that aren't on the record. That asks
 * GitHub, so it is for a page load (Ember's page), not for every question to Ember.
 */
export async function loadEmberRecord(db: DB, userId: string, accountType: string | null | undefined, { withGitHub = false }: { withGitHub?: boolean } = {}): Promise<EmberRecord> {
  const student = accountType !== "professional";
  try {
    const f = await dbFeatures();
    const now = requestTime();
    const [projects, ms, asks, linkedin] = await Promise.all([
      db.from("projects").select("id, title").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20),
      f.milestones ? db.from("milestones").select("id, project_id, title, status, community_id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
      f.milestones ? db.from("milestone_vouches").select("milestone_id, email, created_at").eq("state", "asked").gt("expires_at", new Date(now).toISOString()).order("created_at", { ascending: true }).limit(60) : Promise.resolve({ data: [] }),
      !student && f.linkedinRequired ? db.rpc("needs_linkedin") : Promise.resolve({ data: false }),
    ]);
    const mine = ((projects.data ?? []) as { id: string; title: string }[]);
    const rows = ((ms.data ?? []) as { id: string; project_id: string; title: string; status: string; community_id: string | null }[]);
    const asked = ((asks.data ?? []) as { milestone_id: string; email: string; created_at: string }[]);
    const open: OpenMilestone[] = rows.filter((m) => OPEN.includes(m.status)).slice(0, 12).map((m) => ({
      id: m.id, title: m.title, project_id: m.project_id, club: Boolean(m.community_id),
      asked: asked.filter((a) => a.milestone_id === m.id).map((a) => ({ email: a.email, days: Math.max(0, Math.floor((now - new Date(a.created_at).getTime()) / 86400000)) })),
    }));
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
    return { student, needsLinkedin: linkedin.data === true, projects: mine, open, proven: rows.filter((m) => PROVEN.includes(m.status)).length, repos: [...new Set(repos.map((r) => r.full_name))], unlogged };
  } catch {
    return { ...EMPTY_RECORD, student };
  }
}
