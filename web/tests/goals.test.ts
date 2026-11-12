// The goal path (lib/goals.ts): built from the real record, and the next step is always the one
// thing that moves it forward. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { goalPath, goalTitle, isGoalKind, nextStep } from "../src/lib/goals";

const g = { kind: "internship" as const, target: "power electronics" };

test("the title reads naturally, with or without a target", () => {
  assert.equal(goalTitle(g), "a summer internship in power electronics");
  assert.equal(goalTitle({ kind: "grad", target: "" }), "grad school");
});

test("nothing yet: the next step is a project", () => {
  const p = goalPath(g, { projects: 0, signed: 0, waiting: 0, looked: 0 });
  assert.deepEqual(p.steps.map((s) => s.state), ["now", "next", "next"]);
  assert.equal(p.done, 0);
  assert.equal(p.next.action, "Add a project");
});

test("building: waiting milestones come before new ones", () => {
  assert.equal(nextStep(g, { projects: 1, signed: 1, waiting: 2, looked: 0 }).action, "See what's waiting");
  const n = nextStep(g, { projects: 1, signed: 1, waiting: 0, looked: 0 });
  assert.equal(n.action, "Add a milestone");
  assert.match(n.text, /2 more to go/);
});

test("proven: share it, then keep going once people look", () => {
  const p = goalPath(g, { projects: 2, signed: 3, waiting: 0, looked: 0 });
  assert.deepEqual(p.steps.map((s) => s.state), ["done", "done", "now"]);
  assert.equal(p.next.action, "Copy your link");
  const q = goalPath(g, { projects: 2, signed: 5, waiting: 0, looked: 4 });
  assert.equal(q.done, 3);
  assert.match(q.steps[1].detail, /3 of 3/, "signed is capped at the target");
  assert.equal(q.next.action, "Open Requests");
});

test("each goal has its own bar and signers", () => {
  assert.match(goalPath({ kind: "grad", target: "" }, { projects: 1, signed: 0, waiting: 0, looked: 0 }).steps[1].detail, /0 of 2 milestones signed by a professor or PI/);
  assert.equal(isGoalKind("research"), true);
  assert.equal(isGoalKind("fame"), false);
});
