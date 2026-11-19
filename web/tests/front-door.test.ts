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

test("build-first: the field is guessed from the typed build, or null", async () => {
  const { guessField, firstHeadline } = await import("@/lib/front-door");
  assert.equal(guessField("A line-following robot for the fall expo"), "Engineering");
  assert.equal(guessField("Fine-tuned an LLM to grade lab reports"), "Data & AI");
  assert.equal(guessField("A CubeSat radio that talks to the ground station"), "Space Science");
  assert.equal(guessField("Launched a campus thrift startup with 40 customers"), "Business & Entrepreneurship");
  assert.equal(guessField("A podcast on local history"), "Media & Communication");
  assert.equal(guessField("A rehab robot arm for stroke patients"), "Health & Medicine", "the more specific field wins a tie-break by count");
  assert.equal(guessField("Something I made"), null);
  assert.equal(guessField(""), null);
  for (const f of ["Engineering", "Data & AI", "Space Science"]) assert.ok(TOPICS.some((t) => t.name === f));
  assert.equal(firstHeadline("Engineering", true), "Engineering student");
  assert.equal(firstHeadline("Engineering", false), "Engineering");
});
