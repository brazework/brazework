// What Ember remembers (lib/ember-memory-lines.ts, Linear FIX-233): what it's told, and the card.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cardLabels, cardSummary } from "@/lib/ember-bar";
import { MEMORY_RULE, memoryLines } from "@/lib/ember-memory-lines";

test("Ember is told what the member asked it to remember, in their words", () => {
  const lines = memoryLines([{ body: "Aiming for robotics internships in Boston" }, { body: "My manager is Dana Ruiz" }]);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /"Aiming for robotics internships in Boston"; "My manager is Dana Ruiz"/);
  // It may be out of date: Ember asks rather than assumes.
  assert.match(lines[0], /out of date, ask/);
});

test("nothing remembered: nothing is said, and blanks are skipped", () => {
  assert.deepEqual(memoryLines([]), []);
  assert.deepEqual(memoryLines([{ body: "  " }]), []);
});

test("at most 30 are passed to Ember", () => {
  const line = memoryLines(Array.from({ length: 40 }, (_, i) => ({ body: `fact ${i}` })))[0];
  assert.match(line, /"fact 29"/);
  assert.doesNotMatch(line, /"fact 30"/);
});

test("Ember never offers to remember anything sensitive", () => {
  assert.match(MEMORY_RULE, /Never offer to remember anything sensitive/);
});

test("the remember card says what it does", () => {
  assert.equal(cardLabels("memory", true).confirm, "Remember this");
  const s = cardSummary({ id: "m1", kind: "memory", body: "Keep answers short" });
  assert.equal(s?.title, "Remember: Keep answers short");
  assert.match(s?.lines[0] ?? "", /Forget it any time in Settings/);
});
