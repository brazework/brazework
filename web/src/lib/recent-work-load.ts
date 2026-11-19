import { githubConfig, githubLogin } from "@/lib/github-app";
import { pickRecentWork, workKey, type MergedEvent, type RecentWork } from "@/lib/recent-work-pick";
import { createAdminClient } from "@/lib/supabase/admin";

// Server only: the owner's own merged pull requests from the last 90 days that aren't on their record
// yet (lib/recent-work-pick.ts), for the project page. It only reads. Any failure (GitHub down, the
// account not connected) means an empty list, never a broken page.
export async function loadRecentWork(projectId: string, ownerId: string): Promise<RecentWork[]> {
  const c = githubConfig();
  const db = createAdminClient();
  if (!c || !db) return [];
  try {
    const [{ data: project }, { data: repos }, { data: mine }] = await Promise.all([
      db.from("projects").select("owner_id").eq("id", projectId).maybeSingle(),
      db.from("project_repos").select("repo_id, full_name, installation_id").eq("project_id", projectId).limit(5),
      db.from("github_installations").select("installation_id, github_user_id, suspended_at").eq("installed_by", ownerId).not("github_user_id", "is", null).limit(20),
    ]);
    if (project?.owner_id !== ownerId || !repos?.length) return [];
    // A member can have several installations (their own account, an organisation's). GitHub is asked
    // through the one this project's repo is linked with, which is known to work for it; the member's
    // own GitHub account is the one they proved on any of theirs.
    const via = (repos[0] as { installation_id: number }).installation_id;
    const accts = ((mine ?? []) as { installation_id: number; github_user_id: number; suspended_at: string | null }[]).filter((a) => !a.suspended_at);
    const acct = accts.find((a) => a.installation_id === via) ?? accts[0];
    if (!acct) return [];
    const login = await githubLogin(c, via, acct.github_user_id);
    if (!login) return [];
    const [{ data: events }, { data: backings }] = await Promise.all([
      db.from("build_events").select("repo_id, title, actor, ref, occurred_at").eq("project_id", projectId).eq("kind", "pr_merged").order("occurred_at", { ascending: false }).limit(200),
      db.from("milestone_backings").select("repo_full_name, ref").eq("kind", "pull_request").in("repo_full_name", repos.map((r) => r.full_name)).limit(1000),
    ]);
    const backed = new Set(((backings ?? []) as { repo_full_name: string; ref: string }[]).map((b) => workKey(b.repo_full_name, b.ref)));
    return pickRecentWork({ events: (events ?? []) as MergedEvent[], login, repos: repos as { repo_id: number; full_name: string }[], backed });
  } catch {
    return [];
  }
}
