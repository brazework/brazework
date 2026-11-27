// CI shard plan for the end-to-end suite.
//
// `npm run e2e` (E2E_SHARD unset) runs the SQL rules and then every browser journey below, in this
// order, on one local Supabase. CI sets E2E_SHARD. Each value is one Actions job on its own runner,
// and that job starts its own local Supabase, so shards do not share a database, accounts, or rows.
//
// Browser shards are balanced from the per-spec times in main run 45902587269 (job 140191750586,
// 2026-11-26). The longest journey is s-landing.cjs at 166s. sql is every file in
// supabase/tests/*.test.sql; each one rolls back, and that shard does not start the Next server.
import { readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = join(webDir, "..", "supabase", "tests");

// Full-suite order. The shard is which CI job runs that file.
export const browser = [
  { file: "e2e/a-signup-post.cjs", shard: "b7" },
  { file: "e2e/ab-build-first.cjs", shard: "b3" },
  { file: "e2e/ac-money.cjs", shard: "b3" },
  { file: "e2e/b-clubs-events.cjs", shard: "b5" },
  { file: "e2e/c-messages-projects.cjs", shard: "b7" },
  { file: "e2e/d-search-settings.cjs", shard: "b4" },
  { file: "e2e/e-chat.cjs", shard: "b4" },
  { file: "e2e/f-dock.cjs", shard: "b6" },
  { file: "e2e/h-challenges.cjs", shard: "b6" },
  { file: "e2e/i-chapters.cjs", shard: "b2" },
  { file: "e2e/j-pro.cjs", shard: "b7" },
  { file: "e2e/k-feed-budget.cjs", shard: "b6" },
  { file: "e2e/l-tools.cjs", shard: "b3" },
  { file: "e2e/la-mcp-oauth.cjs", shard: "b2" },
  { file: "e2e/lb-mcp-card.cjs", shard: "b6" },
  { file: "e2e/m-layout.cjs", shard: "b2" },
  { file: "e2e/n-github.cjs", shard: "b3" },
  { file: "e2e/o-vouch.cjs", shard: "b6" },
  { file: "e2e/p-goals.cjs", shard: "b5" },
  { file: "e2e/q-study.cjs", shard: "b3" },
  { file: "e2e/r-officer-setup.cjs", shard: "b6" },
  { file: "e2e/s-landing.cjs", shard: "b1" },
  { file: "e2e/t-model-viewer.cjs", shard: "b7" },
  { file: "e2e/u-build.cjs", shard: "b4" },
  { file: "e2e/v-professional.cjs", shard: "b7" },
  { file: "e2e/w-backed.cjs", shard: "b2" },
  { file: "e2e/x-proof.cjs", shard: "b4" },
  { file: "e2e/y-oauth.cjs", shard: "b5" },
  { file: "e2e/z-confirm.cjs", shard: "b5" },
  { file: "e2e/za-triage.cjs", shard: "b2" },
  { file: "e2e/zb-verify.cjs", shard: "b7" },
  { file: "e2e/zc-signers.cjs", shard: "b6" },
  { file: "e2e/ze-redacted.cjs", shard: "b4" },
  { file: "e2e/zd-review.cjs", shard: "b5" },
  { file: "e2e/zf-tour.cjs", shard: "b2" },
  { file: "e2e/zg-school-link.cjs", shard: "b6" },
  { file: "e2e/zh-attach-later.cjs", shard: "b4" },
  { file: "e2e/zj-team-chats.cjs", shard: "b7" },
  { file: "e2e/zk-linkedin.cjs", shard: "b5" },
  { file: "e2e/zl-chats-look.cjs", shard: "b7" },
  { file: "e2e/zm-photo-viewer.cjs", shard: "b3" },
  { file: "e2e/zo-chat-delete.cjs", shard: "b7" },
  { file: "e2e/zn-view-only.cjs", shard: "b5" },
  { file: "e2e/zp-post-files.cjs", shard: "b4" },
  { file: "e2e/zq-club-projects.cjs", shard: "b2" },
  { file: "e2e/zr-school-portal.cjs", shard: "b4" },
  { file: "e2e/zs-courses.cjs", shard: "b5" },
  { file: "e2e/zt-progress.cjs", shard: "b6" },
  { file: "e2e/zu-courses-b.cjs", shard: "b3" },
  { file: "e2e/zv-project-steps.cjs", shard: "b2" },
  { file: "e2e/g-account.cjs", shard: "b1" },
  { file: "e2e/zj-milestone-log.cjs", shard: "b3" },
];

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function sqlTests() {
  return readdirSync(sqlDir)
    .filter((name) => name.endsWith(".test.sql"))
    .sort(byName)
    .map((name) => `../supabase/tests/${name}`);
}

export function shardIds() {
  const browserIds = [...new Set(browser.map((row) => row.shard))].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
  return ["sql", ...browserIds];
}

export function specsFor(shard) {
  if (shard === "sql") return sqlTests();
  return browser.filter((row) => row.shard === shard).map((row) => row.file);
}

// Problems with this run's jobs. A shard must appear exactly once and conclude success.
// Anything else (missing, failed, cancelled, skipped, timed out) is a problem.
export function judge(jobs, ids = shardIds()) {
  const problems = [];
  for (const id of ids) {
    const name = `e2e shard ${id}`;
    const matches = (jobs || []).filter((job) => job.name === name);
    if (matches.length === 0) problems.push(`${name}: missing`);
    for (const job of matches) {
      if (job.conclusion !== "success") problems.push(`${name}: ${job.conclusion || "no conclusion"}`);
    }
  }
  return problems;
}

export function check() {
  const problems = [];
  const seen = new Set();
  for (const row of browser) {
    if (seen.has(row.file)) problems.push(`duplicate browser journey: ${row.file}`);
    seen.add(row.file);
    if (!/^b\d+$/.test(row.shard)) problems.push(`${row.file} has shard ${row.shard}, expected b1, b2, …`);
    const path = join(webDir, row.file);
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) problems.push(`missing file: ${row.file}`);
  }
  const ids = shardIds().filter((id) => id !== "sql");
  ids.forEach((id, index) => {
    if (id !== `b${index + 1}`) problems.push(`shard ids should be b1, b2, … with no gaps; found ${id} at position ${index + 1}`);
  });
  for (const id of ids) {
    if (specsFor(id).length === 0) problems.push(`shard ${id} has no browser journeys`);
  }
  const sql = sqlTests();
  if (sql.length === 0) problems.push("sql shard has no supabase/tests/*.test.sql files");
  const sqlSeen = new Set();
  for (const file of sql) {
    if (sqlSeen.has(file)) problems.push(`duplicate sql test: ${file}`);
    sqlSeen.add(file);
    if (!statSync(join(webDir, file), { throwIfNoEntry: false })?.isFile()) problems.push(`missing file: ${file}`);
  }
  if (problems.length) throw new Error(problems.join("\n"));
  return { browser: browser.length, sql: sql.length, shards: shardIds().length };
}

async function fetchJobs() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const run = process.env.GITHUB_RUN_ID;
  if (!token || !repo || !run) {
    console.error("gate needs GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_RUN_ID");
    process.exit(1);
  }
  const jobs = [];
  let page = 1;
  for (;;) {
    const url = `https://api.github.com/repos/${repo}/actions/runs/${run}/jobs?filter=latest&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "brazework-e2e-gate",
      },
    });
    if (!res.ok) {
      console.error(`could not read workflow jobs (${res.status})`);
      process.exit(1);
    }
    const body = await res.json();
    const batch = body.jobs || [];
    jobs.push(...batch);
    if (batch.length === 0 || jobs.length >= (body.total_count || 0)) break;
    page += 1;
  }
  return jobs;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString().trim();
  if (!text) throw new Error("gate fixture was empty");
  const body = JSON.parse(text);
  return Array.isArray(body) ? body : body.jobs;
}

function isCli() {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(arg)).href;
  } catch {
    return false;
  }
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "check") {
    const summary = check();
    console.log(`${summary.browser} browser journeys, ${summary.sql} sql tests, ${summary.shards} shards`);
    return;
  }
  if (cmd === "matrix") {
    check();
    process.stdout.write(JSON.stringify(shardIds()));
    return;
  }
  if (cmd === "specs") {
    check();
    for (const row of browser) console.log(row.file);
    return;
  }
  if (cmd === "shard") {
    check();
    const id = process.argv[3];
    if (!shardIds().includes(id)) {
      console.error(`unknown shard: ${id}`);
      process.exit(1);
    }
    for (const file of specsFor(id)) console.log(file);
    return;
  }
  if (cmd === "manifest") {
    check();
    for (const id of shardIds()) {
      const files = specsFor(id);
      console.log(`# ${id} (${files.length})`);
      for (const file of files) console.log(file);
    }
    return;
  }
  if (cmd === "gate") {
    check();
    const jobs = process.env.E2E_GATE_FIXTURE === "1" ? await readStdin() : await fetchJobs();
    const problems = judge(jobs);
    const matrix = process.env.E2E_SHARDS_RESULT;
    if (matrix && matrix !== "success") problems.push(`matrix result: ${matrix}`);
    if (problems.length) {
      console.error(problems.join("\n"));
      const seen = (jobs || [])
        .filter((job) => /e2e shard |End-to-end/.test(job.name || ""))
        .map((job) => `${job.name} [${job.conclusion || "no conclusion"}]`);
      if (seen.length) console.error(`jobs seen:\n${seen.join("\n")}`);
      process.exit(1);
    }
    for (const id of shardIds()) console.log(`e2e shard ${id}: success`);
    return;
  }
  console.error("usage: node e2e/shards.mjs check|matrix|specs|shard <id>|manifest|gate");
  process.exit(2);
}

if (isCli()) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
