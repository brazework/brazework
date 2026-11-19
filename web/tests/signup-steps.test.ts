// The newcomer's progress bar (components/signup-steps.tsx): one list of steps, sized to the path.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { signupSteps } from "../src/components/signup-steps";

test("the way in is build-first, the same five steps for students and professionals", () => {
  assert.deepEqual(signupSteps().map((s) => s.label), ["Account", "About you", "Your build", "Proof", "Who saw it"]);
  assert.deepEqual(signupSteps("build", false).map((s) => s.id), ["account", "about", "build", "proof", "signer"]);
});

test("setting up a profile instead: students end with their club, professionals have no club step", () => {
  assert.deepEqual(signupSteps("profile", true).map((s) => s.label), ["Account", "About you", "Your work", "Your club"]);
  assert.deepEqual(signupSteps("profile", false).map((s) => s.id), ["account", "about", "work"]);
});
