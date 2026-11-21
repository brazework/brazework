// The feed tuned to your goal (lib/feed-goal.ts, Linear FIX-231). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { goalFirst, goalWords } from "@/lib/feed-goal";

const post = (id: string, body: string, tags: string[] = [], author_id = "x") => ({ id, body, tags, reason: "New on Brazework", author_id });

test("the words come from the goal's field and its kind", () => {
  assert.deepEqual(goalWords({ kind: "internship", target: "power electronics" }), ["power", "electronics", "internship", "intern"]);
  assert.deepEqual(goalWords(null), []);
});

test("posts about your goal come first, labelled; the rest keep their order", () => {
  const items = [post("a", "Launch day at the field"), post("b", "Our power electronics team is hiring an intern"), post("c", "Lunch"), post("d", "Ripple down on the buck converter", ["Electronics"])];
  const out = goalFirst(items, { kind: "internship", target: "power electronics" }, "me");
  assert.deepEqual(out.map((p) => p.id), ["b", "d", "a", "c"]);
  assert.equal(out[0].reason, "Toward your goal: internship in power electronics");
  assert.equal(out[2].reason, "New on Brazework");
  assert.equal(out.length, items.length, "the same posts, only reordered");
});

test("whole words only, and your own posts keep their place", () => {
  const out = goalFirst([post("a", "an internal tool"), post("b", "my internship update", [], "me")], { kind: "internship", target: "" }, "me");
  assert.deepEqual(out.map((p) => p.id), ["a", "b"]);
  assert.equal(out[0].reason, "New on Brazework");
});

test("no goal: the feed is unchanged", () => {
  const items = [post("a", "internship"), post("b", "x")];
  assert.deepEqual(goalFirst(items, null, "me"), items);
});
