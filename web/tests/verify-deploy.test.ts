import { test } from "node:test";
import assert from "node:assert/strict";
import { planGreen, planRed, verdict, DECIDING_JOBS } from "../../.github/scripts/verify-deploy.mjs";

const [CHECKS, E2E] = DECIDING_JOBS;
const job = (name: string, conclusion: string) => ({ name, conclusion });

test("only the build and end-to-end jobs decide the verdict", () => {
  assert.equal(verdict([job(CHECKS, "success"), job(E2E, "success"), job("Dependency audit and secret scan", "failure")]), "green");
  assert.equal(verdict([job(CHECKS, "success"), job(E2E, "failure")]), "red");
  assert.equal(verdict([job(CHECKS, "timed_out"), job(E2E, "success")]), "red");
  assert.equal(verdict([job(CHECKS, "success"), job(E2E, "cancelled")]), "unknown");
  assert.equal(verdict([job(CHECKS, "success")]), "unknown");
  assert.equal(verdict([]), "unknown");
});

// History on main: A (verified) ← B (bad) ← C. `contains(x, y)` = y is x or built on x.
const order = ["A", "B", "C"];
const contains = (x: string, y: string) => order.indexOf(y) >= order.indexOf(x);
const A = { sha: "A", id: "dpl_A" };

test("red: production serving the bad commit is rolled back to the last verified one", () => {
  assert.deepEqual(planRed({ bad: "B", current: "B", badDeployment: { id: "dpl_B", state: "READY" }, target: A, contains, fixedBy: null }), { action: "rollback", to: A });
});

test("red: production serving a later commit built on the bad one is rolled back too", () => {
  assert.equal(planRed({ bad: "B", current: "C", badDeployment: { id: "dpl_B", state: "READY" }, target: A, contains, fixedBy: null }).action, "rollback");
});

test("red: a deployment still building is cancelled before it goes live", () => {
  assert.deepEqual(planRed({ bad: "B", current: "A", badDeployment: { id: "dpl_B", state: "BUILDING" }, target: A, contains, fixedBy: null }), { action: "cancel", deployment: "dpl_B" });
});

test("red: nothing to do when production never got it, or a newer commit already passed", () => {
  assert.equal(planRed({ bad: "B", current: "A", badDeployment: { id: "dpl_B", state: "ERROR" }, target: A, contains, fixedBy: null }).action, "none");
  assert.equal(planRed({ bad: "B", current: "C", badDeployment: null, target: A, contains, fixedBy: "C" }).action, "none");
});

test("red with no verified deployment to go back to is reported, not guessed", () => {
  assert.equal(planRed({ bad: "B", current: "B", badDeployment: null, target: null, contains, fixedBy: null }).action, "stuck");
});

test("green: promote only when production is behind this commit", () => {
  const ready = { id: "dpl_C", state: "READY" };
  assert.deepEqual(planGreen({ sha: "C", current: "A", deployment: ready, contains }), { action: "promote", deployment: "dpl_C" });
  assert.equal(planGreen({ sha: "C", current: "C", deployment: ready, contains }).action, "none");
  assert.equal(planGreen({ sha: "B", current: "C", deployment: { id: "dpl_B", state: "READY" }, contains }).action, "none");
  assert.equal(planGreen({ sha: "C", current: "A", deployment: { id: "dpl_C", state: "BUILDING" }, contains }).action, "none");
  assert.equal(planGreen({ sha: "C", current: "A", deployment: null, contains }).action, "none");
});
