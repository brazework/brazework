// Home's first box (lib/front-door.ts firstBuildCopy): a student is asked about the semester and
// their club; someone who works is asked what they're working on, with no semester or club. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { firstBuildCopy } from "@/lib/front-door";

test("someone who works isn't asked about a semester or a club", () => {
  const c = firstBuildCopy({ first: "Josh", student: false, chapter: "NSBE" });
  assert.equal(c.ask, "What are you working on, Josh?");
  for (const s of [c.ask, c.why, c.example]) assert.doesNotMatch(s, /semester|club|NSBE|robot/i);
});

test("a student is asked about the semester, and told who sees it", () => {
  assert.equal(firstBuildCopy({ first: "Maya", student: true }).ask, "What are you building this semester, Maya?");
  assert.match(firstBuildCopy({ first: "Maya", student: true }).why, /your club sees your work/);
  assert.match(firstBuildCopy({ first: "Maya", student: true, chapter: "NSBE UHART" }).why, /NSBE UHART sees your work/);
});

test("no first name still reads as a question", () => {
  assert.equal(firstBuildCopy({ first: " ", student: false }).ask, "What are you working on?");
});
