import { createHmac, timingSafeEqual } from "node:crypto";

// GitHub's webhooks, turned into build-log entries (Linear FIX-92, phase 3). Pure functions, so the
// rules are tested on their own (tests/github-events.test.ts): what counts as progress, and how a
// delivery proves it came from GitHub.

/** True when X-Hub-Signature-256 is GitHub's HMAC-SHA256 of the raw body with our webhook secret.
 *  Compared in constant time; any other format, or no secret configured, is false. */
export function verifySignature(secret: string | undefined, rawBody: string, header: string | null): boolean {
  if (!secret || !header || !/^sha256=[0-9a-f]{64}$/.test(header)) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type BuildEventKind = "pr_merged" | "release" | "ci" | "deploy" | "push";
export type BuildEventDraft = { repo_id: number; kind: BuildEventKind; title: string; url: string; actor: string; ref: string; state: string; occurred_at: string; source_id: string };

type Repo = { id: number; default_branch?: string; html_url?: string; full_name?: string };
const firstLine = (s: string | null | undefined) => (s ?? "").split("\n")[0].trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const https = (u: string | null | undefined, fallback: string) => (u && /^https:\/\//.test(u) ? u : fallback);

/** The build-log entries one delivery adds (usually zero or one). Only progress counts: merged pull
 *  requests, published releases, finished CI on the default branch, successful deploys, and pushes
 *  to the default branch. Opened, closed-unmerged, draft and failed-deploy events add nothing. */
export function eventsFrom(event: string, p: Record<string, unknown>): BuildEventDraft[] {
  const repo = p.repository as Repo | undefined;
  if (!repo?.id) return [];
  const home = repo.html_url && /^https:\/\/github\.com\//.test(repo.html_url) ? repo.html_url : `https://github.com/${repo.full_name ?? ""}`;
  const branch = repo.default_branch ?? "main";

  if (event === "pull_request") {
    const pr = p.pull_request as { number: number; title: string; html_url: string; merged?: boolean; merged_at?: string | null; user?: { login: string } } | undefined;
    if (p.action !== "closed" || !pr?.merged || !pr.merged_at) return [];
    return [{ repo_id: repo.id, kind: "pr_merged", title: clip(`Merged #${pr.number}: ${firstLine(pr.title)}`, 300), url: https(pr.html_url, home), actor: pr.user?.login ?? "", ref: String(pr.number), state: "", occurred_at: pr.merged_at, source_id: `pr:${pr.number}` }];
  }
  if (event === "release") {
    const r = p.release as { id: number; tag_name: string; name?: string | null; html_url: string; draft?: boolean; prerelease?: boolean; published_at?: string | null; author?: { login: string } } | undefined;
    if (p.action !== "published" || !r || r.draft || !r.published_at) return [];
    const name = firstLine(r.name) || r.tag_name;
    return [{ repo_id: repo.id, kind: "release", title: clip(`Released ${name}${r.prerelease ? " (pre-release)" : ""}`, 300), url: https(r.html_url, home), actor: r.author?.login ?? "", ref: r.tag_name, state: r.prerelease ? "prerelease" : "", occurred_at: r.published_at, source_id: `release:${r.id}` }];
  }
  if (event === "check_suite") {
    const cs = p.check_suite as { head_branch?: string | null; head_sha: string; conclusion?: string | null; updated_at?: string } | undefined;
    if (p.action !== "completed" || !cs || cs.head_branch !== branch || !["success", "failure"].includes(cs.conclusion ?? "")) return [];
    return [{ repo_id: repo.id, kind: "ci", title: `CI ${cs.conclusion === "success" ? "passed" : "failed"} on ${branch}`, url: `${home}/commit/${cs.head_sha}`, actor: "", ref: cs.head_sha, state: cs.conclusion!, occurred_at: cs.updated_at ?? new Date().toISOString(), source_id: `ci:${cs.head_sha}` }];
  }
  if (event === "deployment_status") {
    const ds = p.deployment_status as { state: string; environment?: string; environment_url?: string | null; target_url?: string | null; created_at: string } | undefined;
    const d = p.deployment as { id: number; environment?: string } | undefined;
    if (!ds || !d || ds.state !== "success") return [];
    const env = ds.environment || d.environment || "production";
    return [{ repo_id: repo.id, kind: "deploy", title: clip(`Deployed to ${env}`, 300), url: https(ds.environment_url || ds.target_url, home), actor: "", ref: String(d.id), state: env, occurred_at: ds.created_at, source_id: `deploy:${d.id}` }];
  }
  if (event === "push") {
    const commits = (p.commits as { message: string; timestamp?: string }[] | undefined) ?? [];
    const head = p.head_commit as { id: string; message: string; timestamp: string } | null | undefined;
    if (p.ref !== `refs/heads/${branch}` || p.deleted || !commits.length || !head) return [];
    const n = commits.length;
    return [{ repo_id: repo.id, kind: "push", title: clip(`${n} ${n === 1 ? "commit" : "commits"} to ${branch}: ${firstLine(head.message)}`, 300), url: https(p.compare as string | undefined, `${home}/commit/${head.id}`), actor: (p.pusher as { name?: string } | undefined)?.name ?? "", ref: head.id, state: "", occurred_at: head.timestamp, source_id: `push:${head.id}` }];
  }
  return [];
}

/** Repos a delivery removes from the App's reach: their links to projects should go. */
export function removedRepos(event: string, p: Record<string, unknown>): number[] {
  if (event !== "installation_repositories" || p.action !== "removed") return [];
  return ((p.repositories_removed as { id: number }[] | undefined) ?? []).map((r) => r.id).filter((id) => Number.isFinite(id));
}
