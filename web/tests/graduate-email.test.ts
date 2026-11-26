// Graduating: moving your sign-in from a school email to a personal one (lib/graduate-email.ts).
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanEmail, personalEmailProblem, personalEmailSent } from "@/lib/graduate-email";

const base = { current: "dana@hartford.edu", currentIsSchool: true, nextIsSchool: false };

test("a student on a school email can move to a personal one", () => {
  assert.equal(personalEmailProblem({ ...base, next: "dana.r@gmail.com" }), null);
});

test("the new email has to be a real address, and a new one", () => {
  assert.match(personalEmailProblem({ ...base, next: "dana" })!, /Enter the personal email/);
  assert.match(personalEmailProblem({ ...base, next: `${"a".repeat(250)}@x.io` })!, /Enter the personal email/);
  assert.match(personalEmailProblem({ ...base, current: "Dana@Hartford.edu", next: "dana@hartford.edu", nextIsSchool: true })!, /already your sign-in/);
});

test("only from a school email, and never to another school email", () => {
  assert.match(personalEmailProblem({ ...base, current: "dana@gmail.com", currentIsSchool: false, next: "dana@outlook.com" })!, /already a personal one/);
  assert.match(personalEmailProblem({ ...base, next: "dana@yale.edu", nextIsSchool: true })!, /school email/);
});

test("emails are compared trimmed and lower-case, and the message names both inboxes", () => {
  assert.equal(cleanEmail("  Dana.R@Gmail.com "), "dana.r@gmail.com");
  assert.equal(cleanEmail(null), "");
  assert.match(personalEmailSent("dana.r@gmail.com"), /school email and dana\.r@gmail\.com/);
  assert.match(personalEmailSent("dana.r@gmail.com"), /stay on your profile/);
});
