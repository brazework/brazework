import { githubConfig, githubFacts } from "@/lib/github-app";
import { judgeBacking, parseGitHubEvidence, type BackingReason } from "@/lib/backing";
import { createAdminClient } from "@/lib/supabase/admin";

// Server only: asks GitHub whether a milestone's evidence is the member's own work, and records the
// backing with the service key (supabase/backed.sql: members can never write it). Linear FIX-121.
// Every "no" comes back as a reason, never an exception, so a GitHub outage can't break adding a
// milestone that goes to a club or a person.

export type BackingFacts = { kind: "commit" | "pull_request" | "release"; url: string; fullName: string; ref: string; githubUserId: number };

/** Checks the evidence for a member's project. Nothing is written here. */
export async function checkBacking(evidence: string, projectId: string, memberId: string): Promise<{ ok: true; facts: BackingFacts } | { ok: false; reason: BackingReason }> {
  const ev = parseGitHubEvidence(evidence);
  if (!ev) return { ok: false, reason: "not_github" };
  const c = githubConfig();
  const db = createAdminClient();
  if (!c || !db) return { ok: false, reason: "off" };
  try {
    const { data: repos } = await db.from("project_repos").select("installation_id, full_name, default_branch").eq("project_id", projectId);
    const repo = (repos ?? []).find((r) => r.full_name.toLowerCase() === ev.fullName.toLowerCase());
    if (!repo) return { ok: false, reason: "not_linked" };
    // The member's own GitHub account: the one they proved when they connected the App.
    const { data: mine } = await db.from("github_installations").select("github_user_id").eq("installed_by", memberId).not("github_user_id", "is", null).limit(1);
    const memberGithubId = (mine?.[0]?.github_user_id as number | undefined) ?? null;
    if (memberGithubId == null) return { ok: false, reason: "no_account" };
    const facts = await githubFacts(c, repo.installation_id, ev, repo.default_branch);
    const verdict = judgeBacking(ev.kind, facts, memberGithubId);
    if (!verdict.ok) return verdict;
    return { ok: true, facts: { kind: ev.kind, url: evidence.trim(), fullName: repo.full_name, ref: ev.ref, githubUserId: memberGithubId } };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/** Records it. False when it couldn't be written (for example, the same work already backs another
 *  milestone). */
export async function recordBacking(milestoneId: string, f: BackingFacts): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { error } = await db.from("milestone_backings").insert({ milestone_id: milestoneId, kind: f.kind, url: f.url, repo_full_name: f.fullName, ref: f.ref, github_user_id: f.githubUserId });
  return !error;
}
