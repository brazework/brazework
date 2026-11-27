import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, matches, prText, skipReason, DEFAULT_SKIP } from "../../.github/scripts/ship-bot.mjs";

test("wip, dependency and agent branches are never shipped; feature branches are", () => {
  for (const b of ["wip/try-thing", "dependabot/npm_and_yarn/web/x", "cursor/e2e-parallel-shards-4481", "codex/owner-only"]) {
    assert.ok(skipReason(b), b);
  }
  for (const b of ["fix-30-short-topic", "Shua/landing-prices", "landing-elite"]) assert.equal(skipReason(b), null, b);
  assert.ok(skipReason("main"));
  assert.ok(skipReason(""));
});

test("SHIP_BOT_SKIP replaces the defaults", () => {
  assert.equal(skipReason("cursor/x", ["wip/*"]), null);
  assert.ok(skipReason("exp/x", ["exp/*"]));
  assert.ok(DEFAULT_SKIP.includes("wip/*"));
});

test("globs match whole names and treat dots literally", () => {
  assert.ok(matches("wip/a/b", "wip/*"));
  assert.ok(!matches("not-wip/a", "wip/*"));
  assert.ok(!matches("fixa30", "fix.30"));
});

test("auto-merge only for ready pull requests that leave the pipeline alone", () => {
  assert.deepEqual(decide({ isDraft: false, files: ["web/src/app/page.tsx", "supabase/x.sql"] }), { auto: true });
  assert.equal(decide({ isDraft: true }).auto, false);
  assert.equal(decide({ isDraft: false, labels: ["hold"] }).auto, false);
  const p = decide({ isDraft: false, files: ["web/a.ts", ".github/workflows/web.yml", "infra/desired.json"] });
  assert.equal(p.why, "pipeline");
  assert.deepEqual(p.pipeline, [".github/workflows/web.yml", "infra/desired.json"]);
});

test("a new pull request is titled from the branch's first commit", () => {
  const t = prText("fix-30", [{ subject: "FIX-30: Lighthouse budget in CI" }, { subject: "Tighten the budget" }]);
  assert.equal(t.title, "FIX-30: Lighthouse budget in CI");
  assert.match(t.body, /- Tighten the budget/);
  assert.match(t.body, /hold/);
  assert.equal(prText("fix-30", []).title, "fix-30");
});
