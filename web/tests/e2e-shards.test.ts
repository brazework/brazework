// The end-to-end shard plan: every journey and every SQL rule test runs in exactly one shard,
// and the required check fails unless every shard job succeeded. Run: npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { browser, check, judge, resultsAccessIn, resultsHandoffProblems, resultsHandoffs, shardIds, specsFor, sqlTests } from "../e2e/shards.mjs";

const WEB = join(__dirname, "..");
const ROOT = join(WEB, "..");

// The browser journeys run.sh ran on main, in that order, before sharding. A dropped or added file
// fails here until this list and e2e/shards.mjs change together.
const ON_MAIN: [string, string][] = [
  ["e2e/a-signup-post.cjs", "b7"],
  ["e2e/ab-build-first.cjs", "b3"],
  ["e2e/ac-money.cjs", "b3"],
  ["e2e/b-clubs-events.cjs", "b5"],
  ["e2e/c-messages-projects.cjs", "b6"],
  ["e2e/d-search-settings.cjs", "b4"],
  ["e2e/e-chat.cjs", "b4"],
  ["e2e/f-dock.cjs", "b6"],
  ["e2e/h-challenges.cjs", "b7"],
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
  ["e2e/zo-chat-delete.cjs", "b1"],
  ["e2e/zn-view-only.cjs", "b5"],
  ["e2e/zp-post-files.cjs", "b4"],
  ["e2e/zq-club-projects.cjs", "b2"],
  ["e2e/zr-school-portal.cjs", "b4"],
  ["e2e/zs-courses.cjs", "b5"],
  ["e2e/zt-progress.cjs", "b6"],
  ["e2e/zu-courses-b.cjs", "b3"],
  ["e2e/zv-project-steps.cjs", "b2"],
  ["e2e/g-account.cjs", "b7"],
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
  assert.deepEqual(
    ["b1", "b2", "b3", "b4", "b5", "b6", "b7"].map((id) => specsFor(id).length),
    [2, 8, 8, 8, 8, 9, 9],
  );
});

test("a-signup-post runs before h-challenges because the shard plan says so", () => {
  const shard = browser.find((row) => row.file === "e2e/a-signup-post.cjs")?.shard;
  assert.equal(shard, "b7");
  assert.equal(browser.find((row) => row.file === "e2e/h-challenges.cjs")?.shard, shard);
  const planned = browser.filter((row) => row.shard === shard).map((row) => row.file);
  // specsFor follows the plan array. It does not sort names.
  assert.deepEqual(specsFor(shard!), planned);
  const signup = planned.indexOf("e2e/a-signup-post.cjs");
  const challenges = planned.indexOf("e2e/h-challenges.cjs");
  const account = planned.indexOf("e2e/g-account.cjs");
  assert.ok(signup >= 0 && signup < challenges, planned.join("\n"));
  // g-account sorts before h-challenges. The plan runs it after, so a name sort would be a different order.
  assert.ok(account > challenges);
  const sorted = [...planned].sort();
  assert.ok(sorted.indexOf("e2e/g-account.cjs") < sorted.indexOf("e2e/h-challenges.cjs"));
  assert.notDeepEqual(planned, sorted);
});

test("a .results read and a write in different shards fails the plan", () => {
  const { handoffs } = resultsHandoffs();
  assert.deepEqual(handoffs, [
    {
      path: "school-domain.txt",
      writer: "e2e/a-signup-post.cjs",
      reader: "e2e/h-challenges.cjs",
      writerShard: "b7",
      readerShard: "b7",
    },
  ]);
  const signup = readFileSync(join(WEB, "e2e/a-signup-post.cjs"), "utf8");
  const challenges = readFileSync(join(WEB, "e2e/h-challenges.cjs"), "utf8");
  assert.deepEqual(resultsAccessIn(signup), { reads: [], writes: ["school-domain.txt"] });
  assert.deepEqual(resultsAccessIn(challenges), { reads: ["school-domain.txt"], writes: [] });
  // Outside the shard plan: Lighthouse writes the cookie in one file and reads it in another.
  assert.deepEqual(resultsAccessIn(readFileSync(join(WEB, "e2e/session-cookie.cjs"), "utf8")), {
    reads: [],
    writes: ["lh-cookie.txt"],
  });
  assert.deepEqual(resultsAccessIn(readFileSync(join(WEB, "e2e/lighthouserc.cjs"), "utf8")), {
    reads: ["lh-cookie.txt"],
    writes: [],
  });

  const rows = [
    { file: "e2e/a-signup-post.cjs", shard: "b6" },
    { file: "e2e/h-challenges.cjs", shard: "b7" },
  ];
  const access = new Map([
    ["e2e/a-signup-post.cjs", resultsAccessIn(signup)],
    ["e2e/h-challenges.cjs", resultsAccessIn(challenges)],
  ]);
  const split = resultsHandoffProblems(rows, access);
  assert.equal(split.length, 1);
  assert.match(split[0], /h-challenges\.cjs on b7 reads \.results\/school-domain\.txt written by e2e\/a-signup-post\.cjs on b6/);
  assert.deepEqual(
    resultsHandoffProblems(
      rows.map((row) => ({ ...row, shard: "b7" })),
      access,
    ),
    [],
  );
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

test("a missing or empty spec output fails, and a clean passed line does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "e2e-spec-output-"));
  const checkOutput = (...names: string[]) =>
    spawnSync("bash", [join(WEB, "e2e/run.sh"), "--check-output", ...names.map((name) => join(dir, name))], {
      encoding: "utf8",
    });

  const missing = checkOutput("no-such-results.txt");
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /missing spec output/);
  assert.match(missing.stderr, /expected 1 specs to report a passed line, got 0/);

  const emptyPath = join(dir, "empty.txt");
  writeFileSync(emptyPath, "");
  const empty = checkOutput("empty.txt");
  assert.notEqual(empty.status, 0);
  assert.match(empty.stderr, /empty spec output/);

  writeFileSync(join(dir, "quiet.txt"), "still starting\n");
  const quiet = checkOutput("quiet.txt");
  assert.notEqual(quiet.status, 0);
  assert.match(quiet.stderr, /no passed line/);
  assert.doesNotMatch(quiet.stderr, /missing spec output|empty spec output/);

  writeFileSync(join(dir, "clean.txt"), "PASS the page raised no errors\n\n15/15 passed\n");
  const clean = checkOutput("clean.txt");
  assert.equal(clean.status, 0, clean.stderr);

  writeFileSync(join(dir, "failed.txt"), "FAIL a step → ENOENT\n13/14 passed\n");
  const failed = checkOutput("failed.txt");
  assert.notEqual(failed.status, 0);
  assert.doesNotMatch(failed.stderr, /no passed line/);

  writeFileSync(join(dir, "one.txt"), "2/2 passed\n");
  writeFileSync(join(dir, "two.txt"), "");
  const counted = checkOutput("one.txt", "two.txt");
  assert.notEqual(counted.status, 0);
  assert.match(counted.stderr, /empty spec output/);
  assert.match(counted.stderr, /expected 2 specs to report a passed line, got 1/);

  const runSh = readFileSync(join(WEB, "e2e/run.sh"), "utf8");
  assert.match(runSh, /if grep -q "\^FAIL"/);
  assert.match(runSh, /note_spec_output "\$spec" \/tmp\/forge-e2e-out\.txt/);
  assert.doesNotMatch(runSh, /grep -q "\^FAIL".*&& fail=1/);
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

test("the fast gate is a few journeys from the plan, in plan order, with no cross-runner handoffs", async () => {
  const { fast, fastSpecs, browser: plan, check: checkPlan } = await import("../e2e/shards.mjs");
  const specs = fastSpecs();
  assert.equal(specs.length, fast.length);
  assert.ok(specs.length > 0 && specs.length <= 6, "keep the fast gate small: it runs on every pull request");
  const order = plan.map((row: { file: string }) => row.file);
  assert.deepEqual(specs, [...specs].sort((a: string, b: string) => order.indexOf(a) - order.indexOf(b)));
  assert.doesNotThrow(() => checkPlan());
});
