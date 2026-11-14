// The front door (landing → sign-up → first run): the line a visitor types on the landing page is
// carried into sign-up, and a field starts with three interests picked. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanBuild, signupHref, starterInterests } from "@/lib/front-door";
import { TOPICS } from "@/lib/forge";

test("a typed build is tidied: trimmed, single spaces, at most 300 characters, and at least 3", () => {
  assert.equal(cleanBuild("  A line-following   robot \n"), "A line-following robot");
  assert.equal(cleanBuild("ab"), "", "too short to be a build");
  assert.equal(cleanBuild(""), "");
  assert.equal(cleanBuild("x".repeat(400)).length, 300);
});

test("the sign-up link carries the goal, and the build only when there is one", () => {
  assert.equal(signupHref("internship", ""), "/signup?goal=internship");
  assert.equal(signupHref("internship", " a "), "/signup?goal=internship", "a build that's too short is left out");
  assert.equal(signupHref("job", "PCB v2 & bring-up"), "/signup?goal=job&build=PCB+v2+%26+bring-up");
  assert.equal(signupHref("", "A truss bridge"), "/signup?build=A+truss+bridge", "no goal picked (the closing section's box)");
  assert.equal(signupHref("", ""), "/signup");
});

test("a field starts with its first three interests; an unknown field with none", () => {
  for (const t of TOPICS) assert.deepEqual(starterInterests(t.name), t.topics.slice(0, 3));
  assert.deepEqual(starterInterests("Underwater basket weaving"), []);
});
