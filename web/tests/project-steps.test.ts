// Adding a project in steps (lib/project-steps.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { LAST_STEP, PROJECT_STEPS, nextStep, prevStep, topicChips, torchProjectAsk } from "../src/lib/project-steps";

test("three steps, and only the first asks for anything", () => {
  assert.equal(PROJECT_STEPS.length, 3);
  assert.equal(LAST_STEP, 2);
  assert.match(PROJECT_STEPS[0].hint, /all you need to save/);
  assert.match(PROJECT_STEPS[2].hint, /optional/i);
});

test("next and back stay inside the steps", () => {
  assert.equal(nextStep(0), 1);
  assert.equal(nextStep(LAST_STEP), LAST_STEP);
  assert.equal(prevStep(1), 0);
  assert.equal(prevStep(0), 0);
  assert.equal(nextStep(-3), 1);
  assert.equal(prevStep(9), 1);
});

test("a sentence for Torch becomes an ask to add the project; too little is nothing", () => {
  assert.equal(torchProjectAsk("  I built a   line-following robot  "), "Add this project to my profile: I built a line-following robot");
  assert.equal(torchProjectAsk("a robot"), null);
  assert.equal(torchProjectAsk(""), null);
  assert.ok((torchProjectAsk("x".repeat(2000)) ?? "").length <= "Add this project to my profile: ".length + 600);
});

test("topic chips: interests first, nothing already picked, at most the limit", () => {
  const all = ["Robotics", "Rocketry", "Biology", "Design"];
  assert.deepEqual(topicChips(["Design"], all, [], 3), ["Design", "Robotics", "Rocketry"]);
  assert.deepEqual(topicChips(["Design"], all, ["Design", "Robotics"]), ["Rocketry", "Biology"]);
});
