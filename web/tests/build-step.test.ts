// A build card's one next step (lib/build-step.ts): what to do next on the way from built to signed.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStage, nextBuildStep } from "@/lib/build-step";

test("the next step follows the build's real state", () => {
  assert.equal(nextBuildStep({ updates: 0, verified: 0, waiting: 0 }).kind, "log");
  assert.equal(nextBuildStep({ updates: 0, verified: 0, waiting: 0 }).label, "Log your first update");
  assert.equal(nextBuildStep({ updates: 2, verified: 0, waiting: 0 }).kind, "verify");
  assert.equal(nextBuildStep({ updates: 2, verified: 0, waiting: 0 }).label, "Get it verified");
  assert.equal(nextBuildStep({ updates: 2, verified: 0, waiting: 1 }).kind, "waiting");
  assert.equal(nextBuildStep({ updates: 2, verified: 3, waiting: 0 }).label, "Log an update");
  assert.equal(nextBuildStep({ updates: 0, verified: 1, waiting: 0 }).label, "Log an update", "already signed: keep it moving");
});

test("the stage a build has reached: built, then signed", () => {
  assert.equal(buildStage({ updates: 0, verified: 0, waiting: 0 }), 0);
  assert.equal(buildStage({ updates: 1, verified: 0, waiting: 0 }), 1);
  assert.equal(buildStage({ updates: 1, verified: 0, waiting: 2 }), 1);
  assert.equal(buildStage({ updates: 0, verified: 2, waiting: 0 }), 2);
});
