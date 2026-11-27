// The end-to-end shard plan: every journey and every SQL rule test runs in exactly one shard,
// and the required check fails unless every shard job succeeded. Run: npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { browser, check, judge, shardIds, specsFor, sqlTests } from "../e2e/shards.mjs";

const WEB = join(__dirname, "..");
const ROOT = join(WEB, "..");

// The browser journeys run.sh ran on main, in that order, before sharding. A dropped or added file
// fails here until this list and e2e/shards.mjs change together.
const ON_MAIN: [string, string][] = [
  ["e2e/a-signup-post.cjs", "b7"],
  ["e2e/ab-build-first.cjs", "b3"],
  ["e2e/ac-money.cjs", "b3"],
  ["e2e/b-clubs-events.cjs", "b5"],
  ["e2e/c-messages-projects.cjs", "b7"],
  ["e2e/d-search-settings.cjs", "b4"],
  ["e2e/e-chat.cjs", "b4"],
  ["e2e/f-dock.cjs", "b6"],
  ["e2e/h-challenges.cjs", "b6"],
  ["e2e/i-chapters.cjs", "b2"],
  ["e2e/j-pro.cjs", "b7"],
  ["e2e/k-feed-budget.cjs", "b6"],
  ["e2e/l-tools.cjs", "b3"],
  ["e2e/la-mcp-oauth.cjs", "b2"],
  ["e2e/lb-mcp-card.cjs", "b6"],
  ["e2e/m-layout.cjs", "b2"],
  ["e2e/n-github.cjs", "b3"],
  ["e2e/o-vouch.cjs", "b6"],
  ["e2e/p-goals.cjs", "b5"],
  ["e2e/q-study.cjs", "b3"],
  ["e2e/r-officer-setup.cjs", "b6"],
  ["e2e/s-landing.cjs", "b1"],
  ["e2e/t-model-viewer.cjs", "b7"],
  ["e2e/u-build.cjs", "b4"],
  ["e2e/v-professional.cjs", "b7"],
  ["e2e/w-backed.cjs", "b2"],
  ["e2e/x-proof.cjs", "b4"],
  ["e2e/y-oauth.cjs", "b5"],
  ["e2e/z-confirm.cjs", "b5"],
  ["e2e/za-triage.cjs", "b2"],
  ["e2e/zb-verify.cjs", "b7"],
  ["e2e/zc-signers.cjs", "b6"],
  ["e2e/ze-redacted.cjs", "b4"],
  ["e2e/zd-review.cjs", "b5"],
  ["e2e/zf-tour.cjs", "b2"],
  ["e2e/zg-school-link.cjs", "b6"],
  ["e2e/zh-attach-later.cjs", "b4"],
  ["e2e/zj-team-chats.cjs", "b7"],
  ["e2e/zk-linkedin.cjs", "b5"],
  ["e2e/zl-chats-look.cjs", "b7"],
  ["e2e/zm-photo-viewer.cjs", "b3"],
  ["e2e/zo-chat-delete.cjs", "b7"],
  ["e2e/zn-view-only.cjs", "b5"],
  ["e2e/zp-post-files.cjs", "b4"],
  ["e2e/zq-club-projects.cjs", "b2"],
  ["e2e/zr-school-portal.cjs", "b4"],
  ["e2e/zs-courses.cjs", "b5"],
  ["e2e/zt-progress.cjs", "b6"],
  ["e2e/zu-courses-b.cjs", "b3"],
  ["e2e/zv-project-steps.cjs", "b2"],
  ["e2e/g-account.cjs", "b1"],
  ["e2e/zj-milestone-log.cjs", "b3"],
];

test("browser journeys match main, each in exactly one shard", () => {
  check();
  assert.equal(browser.length, ON_MAIN.length);
  assert.equal(ON_MAIN.length, 52);
  assert.deepEqual(
    browser.map((row) => [row.file, row.shard]),
    ON_MAIN,
  );
  const assigned = new Map<string, string[]>();
  for (const [file, shard] of ON_MAIN) {
    assigned.set(shard, [...(assigned.get(shard) ?? []), file]);
  }
  let covered = 0;
  for (const [shard, files] of assigned) {
    assert.deepEqual(specsFor(shard), files);
    covered += files.length;
  }
  assert.equal(covered, 52);
  assert.deepEqual(shardIds(), ["sql", "b1", "b2", "b3", "b4", "b5", "b6", "b7"]);
});

test("the sql shard is every database rule test on disk", () => {
  const onDisk = readdirSync(join(ROOT, "supabase", "tests"))
    .filter((name) => name.endsWith(".test.sql"))
    .sort();
  const listed = sqlTests().map((path) => path.split("/").pop());
  assert.deepEqual(listed, onDisk);
  assert.equal(onDisk.length, 85);
  assert.equal(specsFor("sql").length, onDisk.length);
});

test("the required check fails unless every shard succeeded", () => {
  const ids = shardIds();
  const jobs = ids.map((id) => ({ name: `e2e shard ${id}`, conclusion: "success" }));
  assert.deepEqual(judge(jobs), []);
  assert.deepEqual(judge([...jobs, { name: "Typecheck, lint, unit tests, build", conclusion: "failure" }]), []);

  for (const conclusion of ["failure", "cancelled", "skipped", "timed_out", ""]) {
    const broken = jobs.map((job, index) => (index === 1 ? { ...job, conclusion } : job));
    const problems = judge(broken);
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(`e2e shard b1: ${conclusion || "no conclusion"}`));
  }

  assert.match(judge(jobs.slice(1)).join("\n"), /e2e shard sql: missing/);
  const doubled = [...jobs, { name: "e2e shard b3", conclusion: "skipped" }];
  assert.match(judge(doubled).join("\n"), /e2e shard b3: skipped/);
});

test("the workflow keeps the required check name and fails closed", () => {
  const yml = readFileSync(join(ROOT, ".github", "workflows", "web.yml"), "utf8");
  const required = [...yml.matchAll(/^ {4}name: End-to-end \(database rules \+ browser journeys\)$/gm)];
  assert.equal(required.length, 1);
  assert.match(yml, /name: e2e shard \$\{\{ matrix\.shard \}\}/);
  assert.match(yml, /fail-fast: false/);
  assert.match(yml, /actions: read/);
  assert.match(yml, /E2E_SHARD="\$\{\{ matrix\.shard \}\}" bash e2e\/run\.sh/);
  assert.match(yml, /node e2e\/shards\.mjs gate/);
  assert.doesNotMatch(yml, /continue-on-error:\s*true/);
  // Shard timeout stays the old e2e budget. The aggregator is the short required check.
  assert.match(yml, /timeout-minutes: 35/);
  assert.match(yml, /timeout-minutes: 5/);
});

test("gate command exits non-zero when a shard was skipped", () => {
  const ids = shardIds();
  const jobs = ids.map((id) => ({ name: `e2e shard ${id}`, conclusion: id === "b2" ? "skipped" : "success" }));
  const run = spawnSync(process.execPath, ["e2e/shards.mjs", "gate"], {
    cwd: WEB,
    input: JSON.stringify({ jobs }),
    env: { ...process.env, E2E_GATE_FIXTURE: "1", E2E_SHARDS_RESULT: "success" },
    encoding: "utf8",
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /e2e shard b2: skipped/);

  const ok = spawnSync(process.execPath, ["e2e/shards.mjs", "gate"], {
    cwd: WEB,
    input: JSON.stringify({ jobs: ids.map((id) => ({ name: `e2e shard ${id}`, conclusion: "success" })) }),
    env: { ...process.env, E2E_GATE_FIXTURE: "1", E2E_SHARDS_RESULT: "" },
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /e2e shard sql: success/);
  assert.match(ok.stdout, /e2e shard b7: success/);

  const matrix = spawnSync(process.execPath, ["e2e/shards.mjs", "gate"], {
    cwd: WEB,
    input: JSON.stringify({ jobs: ids.map((id) => ({ name: `e2e shard ${id}`, conclusion: "success" })) }),
    env: { ...process.env, E2E_GATE_FIXTURE: "1", E2E_SHARDS_RESULT: "cancelled" },
    encoding: "utf8",
  });
  assert.notEqual(matrix.status, 0);
  assert.match(matrix.stderr, /matrix result: cancelled/);
});
