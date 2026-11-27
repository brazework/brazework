#!/usr/bin/env node
// Ship Bot (Linear FIX-316): push a branch and it ships. Run by .github/workflows/ship-bot.yml.
//
// On a push to a branch, it opens the pull request if there isn't one (title from the branch's first
// commit, body from its commits) and turns auto-merge on. From there the normal pipeline takes over:
// the required checks, the merge, Vercel's deploy, the database steps.
//
// It never turns auto-merge on when:
//   - the branch matches SHIP_BOT_SKIP (default: wip/*, dependabot/*, cursor/*, codex/*): back up
//     half-done work on wip/…; dependency and agent pull requests keep their own review rules
//   - the pull request is a draft, or has the "hold" label (adding "hold" later turns auto-merge off)
//   - it changes the pipeline itself (.github/ or infra/): a broken pipeline can't fix or roll back
//     itself, so a person merges those. The bot says so on the pull request, once.
//   - the branch's last pull request was closed without merging: someone closed it on purpose
//
// Uses the Ship Bot GitHub App's token (GH_TOKEN), not the workflow's own token: a pull request opened
// with the workflow token doesn't start CI, and a merge it enables doesn't start main's workflows.
import { execFileSync } from "node:child_process";

export const DEFAULT_SKIP = ["wip/*", "dependabot/*", "cursor/*", "codex/*"];
export const PIPELINE_PATHS = [".github/", "infra/"];
export const HOLD_LABEL = "hold";
const NOTE_MARK = "<!-- ship-bot:pipeline -->";

/** Glob with * only (matches anything, slashes included). */
export function matches(branch, pattern) {
  const re = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return re.test(branch);
}

/** Why this branch is never shipped by the bot, or null. */
export function skipReason(branch, skip = DEFAULT_SKIP) {
  if (!branch || branch === "main") return "main itself";
  const hit = skip.find((p) => matches(branch, p));
  return hit ? `branch matches ${hit}` : null;
}

/**
 * Whether a pull request should have auto-merge on, and why not when it shouldn't.
 * @param {{ isDraft?: boolean, labels?: string[], files?: string[] }} pr
 * @returns {{ auto: boolean, why?: string, pipeline?: string[] }}
 */
export function decide({ isDraft, labels = [], files = [] }) {
  if (isDraft) return { auto: false, why: "draft" };
  if (labels.includes(HOLD_LABEL)) return { auto: false, why: `"${HOLD_LABEL}" label` };
  const pipeline = files.filter((f) => PIPELINE_PATHS.some((p) => f.startsWith(p)));
  if (pipeline.length) return { auto: false, why: "pipeline", pipeline };
  return { auto: true };
}

/** Title and body for a new pull request from the branch's commits (oldest first). */
export function prText(branch, commits) {
  const title = commits[0]?.subject || branch;
  const list = commits.map((c) => `- ${c.subject}`).join("\n");
  return {
    title: title.slice(0, 250),
    body: `${list || "(no commits yet)"}\n\nOpened by Ship Bot on push. It merges itself when the required checks pass. Add the \`${HOLD_LABEL}\` label to stop it.`,
  };
}

const gh = (args, input) => execFileSync("gh", args, { encoding: "utf8", input, stdio: [input ? "pipe" : "ignore", "pipe", "inherit"] }).trim();
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const repo = process.env.GITHUB_REPOSITORY;

function prFor(branch) {
  const all = JSON.parse(gh(["pr", "list", "-R", repo, "--head", branch, "--state", "all", "--json", "number,state,createdAt", "--limit", "20"]));
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { open: all.find((p) => p.state === "OPEN"), last: all[0] };
}

function openPr(branch) {
  git(["fetch", "-q", "origin", "main", branch]);
  const log = git(["log", "--reverse", "--format=%s", `origin/main..origin/${branch}`]);
  const commits = log ? log.split("\n").map((subject) => ({ subject })) : [];
  if (!commits.length) return null;
  const { title, body } = prText(branch, commits);
  const url = gh(["pr", "create", "-R", repo, "--head", branch, "--base", "main", "--title", title, "--body-file", "-"], body);
  console.log(`Opened ${url}`);
  return Number(url.split("/").pop());
}

function apply(number) {
  const pr = JSON.parse(gh(["pr", "view", String(number), "-R", repo, "--json", "isDraft,labels,files,autoMergeRequest,comments"]));
  const d = decide({ isDraft: pr.isDraft, labels: pr.labels.map((l) => l.name), files: pr.files.map((f) => f.path) });
  if (d.auto) {
    if (!pr.autoMergeRequest) gh(["pr", "merge", String(number), "-R", repo, "--auto", "--squash"]);
    console.log(`#${number}: auto-merge on`);
    return;
  }
  if (pr.autoMergeRequest) gh(["pr", "merge", String(number), "-R", repo, "--disable-auto"]);
  console.log(`#${number}: auto-merge off (${d.why})`);
  if (d.why === "pipeline" && !pr.comments.some((c) => c.body.includes(NOTE_MARK))) {
    const files = d.pipeline.slice(0, 10).map((f) => `\`${f}\``).join(", ");
    gh(["pr", "comment", String(number), "-R", repo, "--body-file", "-"], `${NOTE_MARK}\nShip Bot left auto-merge off: this changes the pipeline (${files}). A broken pipeline can't roll itself back, so a person merges this one: \`gh pr merge ${number} --auto --squash\`.`);
  }
}

function main() {
  const event = process.env.GITHUB_EVENT_NAME;
  const skip = (process.env.SHIP_BOT_SKIP || "").split(/[\s,]+/).filter(Boolean);
  const branch = event === "push" ? process.env.GITHUB_REF_NAME : process.env.PR_HEAD;
  const why = skipReason(branch, skip.length ? skip : DEFAULT_SKIP);
  if (why) return console.log(`Skipped ${branch}: ${why}`);

  if (event === "push") {
    const { open, last } = prFor(branch);
    if (!open && last && last.state === "CLOSED") return console.log(`Skipped ${branch}: its pull request #${last.number} was closed without merging`);
    const number = open?.number ?? openPr(branch);
    if (!number) return console.log(`Skipped ${branch}: no commits ahead of main`);
    return apply(number);
  }
  if (process.env.PR_FORK === "true") return console.log("Skipped: pull request from a fork");
  return apply(Number(process.env.PR_NUMBER));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
