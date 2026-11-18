// The nightly drift check's Linear issue (.github/scripts/infra-drift.mjs, Linear FIX-131). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { TITLE, driftBody } from "../../.github/scripts/infra-drift.mjs";

const output = `Drift: 1 difference(s) between infra/desired.json and production:
  supabase.auth.rate_limit_email_sent
    repo: 100
    live: 30`;

test("the issue shows exactly what drifted, and both ways to resolve it", () => {
  const body = driftBody(output);
  assert.ok(body.includes("supabase.auth.rate_limit_email_sent"));
  assert.ok(body.includes("live: 30"));
  assert.match(body, /--capture/);
  assert.match(body, /Put the setting back/);
  assert.ok(!body.includes("[The run]"));
});

test("it links the run when there is one", () => {
  assert.match(driftBody(output, "https://github.com/brazework/brazework/actions/runs/1"), /\[The run\]\(https:\/\/github\.com\/brazework\/brazework\/actions\/runs\/1\)/);
});

test("the title starts with the prefix the open-issue lookup uses", () => {
  assert.ok(TITLE.startsWith("Infra drift"));
});
