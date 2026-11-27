#!/usr/bin/env node
// Verify after deploy (Linear FIX-314, part of FIX-313 "ship then verify"). Run by
// .github/workflows/verify.yml after every "Web (Next.js)" run for a push to main.
//
// The Web run is the full check of that commit: the build, the unit tests and every end-to-end
// journey on the runner's own local stack (never production: journeys write data). By then
// Vercel has usually deployed the commit already. This script acts on the result:
//
//   green → marks the commit "production/verified" (a GitHub commit status). If production is behind
//           it (after a rollback, Vercel stops putting new deployments live until one is promoted),
//           promotes this commit's deployment.
//   red   → if production is serving this commit or anything built on it, rolls production back to
//           the newest commit marked verified. If this commit's deployment is still building, cancels
//           it. Then opens a revert pull request (labelled "hold": a person decides revert or fix
//           forward), files or updates a Linear issue, and fails the run so GitHub emails us.
//   other (cancelled, skipped) → does nothing.
//
// Without VERCEL_TOKEN it still marks commits and reports, but can't roll back: it says so and fails
// on red. Modes (workflow_dispatch): "dry-run" prints what it would do; "mark-verified" records a
// commit as known-good without a Web run (the first time, or after fixing production by hand).
import { execFileSync } from "node:child_process";

export const STATUS_CONTEXT = "production/verified";
/** The jobs whose result decides. Others (security audit, speed scan) can't trigger a rollback. */
export const DECIDING_JOBS = ["Typecheck, lint, unit tests, build", "End-to-end (database rules + browser journeys)"];

/** "green", "red" or "unknown" from a Web run's jobs ([{ name, conclusion }]). */
export function verdict(jobs) {
  const deciding = DECIDING_JOBS.map((name) => jobs.find((j) => j.name === name));
  if (deciding.some((j) => j?.conclusion === "failure" || j?.conclusion === "timed_out")) return "red";
  if (deciding.every((j) => j?.conclusion === "success")) return "green";
  return "unknown";
}

/**
 * What to do with production after a red commit.
 * @param {{ bad: string, current: string|null, badDeployment: { id: string, state: string }|null,
 *           target: { sha: string, id: string }|null, contains: (ancestor: string, commit: string) => boolean,
 *           fixedBy: string|null }} s
 */
export function planRed(s) {
  if (s.fixedBy) return { action: "none", why: `a newer commit (${s.fixedBy.slice(0, 7)}) is already verified` };
  const live = s.current && s.contains(s.bad, s.current);
  if (live) {
    if (!s.target) return { action: "stuck", why: "production has the failing commit and no verified deployment to go back to" };
    return { action: "rollback", to: s.target };
  }
  if (s.badDeployment && !["READY", "ERROR", "CANCELED"].includes(s.badDeployment.state)) {
    return { action: "cancel", deployment: s.badDeployment.id };
  }
  return { action: "none", why: "production isn't serving the failing commit" };
}

/** Whether a green commit's deployment should be promoted: only when production is behind it. */
export function planGreen({ sha, current, deployment, contains }) {
  if (!deployment || deployment.state !== "READY") return { action: "none", why: "no ready deployment for this commit yet" };
  if (current === sha) return { action: "none", why: "already live" };
  if (current && contains(sha, current)) return { action: "none", why: "production already has a newer commit" };
  return { action: "promote", deployment: deployment.id };
}

// ---------- I/O ----------
const env = process.env;
const repo = env.GITHUB_REPOSITORY;
const VERCEL = { team: env.VERCEL_TEAM || "ixcoleman123", project: env.VERCEL_PROJECT || "forge-app" };
const sh = (cmd, args, input) => execFileSync(cmd, args, { encoding: "utf8", input, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] }).trim();
const gh = (args, input) => sh("gh", args, input);
const isAncestor = (a, b) => { try { sh("git", ["merge-base", "--is-ancestor", a, b]); return true; } catch { return false; } };

async function vercel(path, { method = "GET" } = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://api.vercel.com${path}${sep}slug=${VERCEL.team}`, { method, headers: { authorization: `Bearer ${env.VERCEL_TOKEN}`, "content-type": "application/json" } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Vercel ${method} ${path.split("?")[0]}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function vercelState() {
  const project = await vercel(`/v9/projects/${VERCEL.project}`);
  const { deployments } = await vercel(`/v6/deployments?projectId=${project.id}&target=production&limit=100`);
  const bySha = new Map();
  for (const d of deployments) {
    const sha = d.meta?.githubCommitSha;
    if (sha && !bySha.has(sha)) bySha.set(sha, { id: d.uid, state: d.state ?? d.readyState, createdAt: d.createdAt });
  }
  const currentId = project.targets?.production?.id;
  const current = currentId ? (await vercel(`/v13/deployments/${currentId}`)).meta?.githubCommitSha ?? null : null;
  return { projectId: project.id, bySha, current };
}

function verifiedShas(shas) {
  const out = new Set();
  for (const sha of shas) {
    const statuses = JSON.parse(gh(["api", `repos/${repo}/commits/${sha}/statuses?per_page=100`]));
    const mine = statuses.find((s) => s.context === STATUS_CONTEXT);
    if (mine?.state === "success") out.add(sha);
  }
  return out;
}

function setStatus(sha, state, description) {
  const url = `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`;
  gh(["api", "-X", "POST", `repos/${repo}/statuses/${sha}`, "-f", `state=${state}`, "-f", `context=${STATUS_CONTEXT}`, "-f", `description=${description.slice(0, 140)}`, "-f", `target_url=${url}`]);
}

function openRevertPr(sha, runUrl) {
  const files = sh("git", ["show", "--name-only", "--format=", sha]).split("\n");
  if (files.some((f) => f.startsWith(".github/workflows/"))) return "skipped: the commit changes a workflow, which this job's token can't push";
  const branch = `revert-${sha.slice(0, 7)}`;
  sh("git", ["config", "user.name", "github-actions[bot]"]);
  sh("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  sh("git", ["switch", "-q", "-c", branch, "origin/main"]);
  try { sh("git", ["revert", "--no-edit", sha]); } catch { sh("git", ["revert", "--abort"]); return "skipped: it doesn't revert cleanly on top of main"; }
  sh("git", ["push", "-q", "origin", branch]);
  try { gh(["label", "create", "hold", "-R", repo, "--color", "d93f0b", "--description", "Ship Bot leaves auto-merge off"]); } catch { /* already there */ }
  const subject = sh("git", ["log", "-1", "--format=%s", sha]);
  return gh(["pr", "create", "-R", repo, "--head", branch, "--base", "main", "--label", "hold", "--title", `Revert "${subject}"`.slice(0, 250), "--body-file", "-"],
    `${sha.slice(0, 7)} failed its check after deploy (${runUrl}), and production was taken off it.\n\nMerge this to undo it, or close it and fix forward. The \`hold\` label keeps it from merging itself.`);
}

async function main() {
  const mode = env.MODE || "run";
  const sha = env.HEAD_SHA;
  if (!sha) throw new Error("HEAD_SHA isn't set");
  sh("git", ["fetch", "-q", "origin", "main"]);
  const runUrl = env.WEB_RUN_URL || `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`;
  const dry = mode === "dry-run";
  const say = (s) => { console.log(s); if (env.GITHUB_STEP_SUMMARY) execFileSync("sh", ["-c", `cat >> "$GITHUB_STEP_SUMMARY"`], { input: s + "\n" }); };

  if (mode === "mark-verified") { setStatus(sha, "success", "Marked known-good by hand"); return say(`Marked ${sha.slice(0, 7)} verified.`); }

  const jobs = env.WEB_RUN_ID ? JSON.parse(gh(["api", `repos/${repo}/actions/runs/${env.WEB_RUN_ID}/jobs?per_page=100`, "--jq", "[.jobs[] | {name, conclusion}]"])) : [];
  const v = env.FORCE_VERDICT || verdict(jobs);
  say(`## Verify after deploy: ${sha.slice(0, 7)} is ${v}`);
  if (v === "unknown") return say("The Web run was cancelled or skipped its deciding jobs. Nothing to do.");

  const canDeploy = Boolean(env.VERCEL_TOKEN);
  const state = canDeploy ? await vercelState() : null;
  if (state) say(`Production is serving ${state.current?.slice(0, 7) ?? "an unknown commit"}.`);
  else say("VERCEL_TOKEN isn't set: recording the result only, no rollback or promote.");

  if (v === "green") {
    if (!dry) setStatus(sha, "success", "Full check passed after deploy");
    if (!state) return;
    // The deployment may still be building: give it up to 10 minutes.
    let dep = state.bySha.get(sha);
    for (let i = 0; i < 20 && dep && dep.state !== "READY" && dep.state !== "ERROR" && dep.state !== "CANCELED"; i++) {
      await new Promise((r) => setTimeout(r, 30_000));
      dep = (await vercelState()).bySha.get(sha);
    }
    const p = planGreen({ sha, current: state.current, deployment: dep, contains: isAncestor });
    if (p.action === "promote") { say(`Production is behind: promoting ${sha.slice(0, 7)}.`); if (!dry) await vercel(`/v10/projects/${state.projectId}/promote/${p.deployment}`, { method: "POST" }); }
    else say(`No promote: ${p.why}.`);
    return;
  }

  // red
  if (!dry) setStatus(sha, "failure", "Full check failed after deploy");
  const newer = sh("git", ["rev-list", `${sha}..origin/main`]).split("\n").filter(Boolean);
  const fixedBy = [...verifiedShas(newer.slice(0, 20))][0] ?? null;
  const history = sh("git", ["rev-list", "--first-parent", "-n", "50", `${sha}^`]).split("\n").filter(Boolean);
  let target = null;
  if (state) {
    const ok = verifiedShas(history.filter((h) => state.bySha.get(h)?.state === "READY"));
    const good = history.find((h) => ok.has(h));
    if (good) target = { sha: good, id: state.bySha.get(good).id };
  }
  const plan = planRed({ bad: sha, current: state?.current ?? null, badDeployment: state?.bySha.get(sha) ?? null, target, contains: isAncestor, fixedBy });

  let did;
  if (!state) did = "Couldn't act on production (no VERCEL_TOKEN). Roll back by hand: Vercel → forge-app → Deployments → Instant Rollback.";
  else if (plan.action === "rollback") { did = `Rolled production back to ${plan.to.sha.slice(0, 7)}.`; if (!dry) await vercel(`/v1/projects/${state.projectId}/rollback/${plan.to.id}?description=${encodeURIComponent(`Verify failed for ${sha.slice(0, 7)}`)}`, { method: "POST" }); }
  else if (plan.action === "cancel") { did = `Cancelled ${sha.slice(0, 7)}'s deployment before it went live.`; if (!dry) await vercel(`/v12/deployments/${plan.deployment}/cancel`, { method: "PATCH" }); }
  else if (plan.action === "stuck") did = `Production is serving the failing commit and there's no verified deployment in the last 50 commits to go back to. Roll back by hand.`;
  else did = `Production left as it is: ${plan.why}.`;
  say(did);

  let revert = "not opened (dry run)";
  if (!dry && (plan.action !== "none" || (!state && !fixedBy))) { try { revert = openRevertPr(sha, runUrl); } catch (e) { revert = `failed: ${e.message.split("\n")[0]}`; } }
  say(`Revert pull request: ${revert}`);

  if (!dry && (plan.action !== "none" || (!state && !fixedBy))) {
    const { fileOrComment } = await import("./linear-issue.mjs");
    const subject = sh("git", ["log", "-1", "--format=%s", sha]);
    await fileOrComment({
      prefix: "Production rolled back",
      title: `Production rolled back: ${subject}`.slice(0, 200),
      body: `**${sha.slice(0, 7)}** (${subject}) failed its full check after deploy: ${runUrl}\n\n${did}\n\nRevert pull request: ${revert}\n\nFailure screenshots are on the Web run. Merge the revert or fix forward; the next commit that passes puts production back on the newest code by itself.`,
    });
  }
  if (plan.action !== "none" || (!state && !fixedBy)) process.exitCode = 1; // red run: GitHub emails us
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
