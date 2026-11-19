// The newcomer's progress bar (components/signup-steps.tsx): one list of steps, sized to the path.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { signupSteps } from "../src/components/signup-steps";

test("students (and anyone not yet known to be a professional) have four steps, ending with their club", () => {
  assert.deepEqual(signupSteps(true).map((s) => s.label), ["Account", "About you", "Your work", "Your club"]);
});

test("professionals have three: no club step", () => {
  assert.deepEqual(signupSteps(false).map((s) => s.id), ["account", "about", "work"]);
});
