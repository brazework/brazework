import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalTag, hashtagFor, hashtagParts, hashtagsIn, validTag } from "../src/lib/hashtags";

test("hashtagsIn: first three distinct tags, known topics under their real names", () => {
  assert.deepEqual(hashtagsIn("Static fire #3 #MachineLearning and #myRover, #machinelearning again #3D #extra"), ["Machine Learning", "myrover", "3d"]);
  assert.deepEqual(hashtagsIn("no tags here"), []);
});

test("hashtagsIn: a # inside a word, a URL fragment or an email is not a tag", () => {
  assert.deepEqual(hashtagsIn("issue#12 https://x.dev/a#top mail a@b.c"), []);
  assert.deepEqual(hashtagsIn("(#rocketry) works"), ["rocketry"]);
});

test("canonicalTag and hashtagFor round-trip every topic", () => {
  assert.equal(canonicalTag("BatteriesElectrochemistry"), "Batteries & Electrochemistry");
  assert.equal(hashtagFor("Batteries & Electrochemistry"), "#BatteriesElectrochemistry");
  assert.equal(canonicalTag(hashtagFor("Human-Computer Interaction").slice(1)), "Human-Computer Interaction");
  assert.equal(canonicalTag("MyRover"), "myrover");
});

test("hashtagParts keeps the text and marks each tag", () => {
  const parts = hashtagParts("Day 3 #rocketry: #MachineLearning!");
  assert.equal(parts.map((p) => (typeof p === "string" ? p : p.written)).join(""), "Day 3 #rocketry: #MachineLearning!");
  assert.deepEqual(parts.filter((p) => typeof p !== "string"), [{ written: "#rocketry", tag: "rocketry" }, { written: "#MachineLearning", tag: "Machine Learning" }]);
});

test("validTag: known topics or well-formed lower-case new tags", () => {
  assert.ok(validTag("Machine Learning"));
  assert.ok(validTag("my-rover_2"));
  assert.ok(!validTag("MyRover"));
  assert.ok(!validTag("has space"));
  assert.ok(!validTag("<script>"));
});
