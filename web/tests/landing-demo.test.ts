// The landing page's demos (lib/landing-demo.ts): the tour's guidance follows what the visitor has
// done, Ember's reply is written out in whole words, and the company search only finds signed work.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILDERS, EMBER_ASKS, EXAMPLE_BUILD, PLACES, SEARCH_TRIES, searchBuilders, stageTitle, tourHint, typedSoFar } from "@/lib/landing-demo";

test("the hero's milestone is the visitor's build, or the example until they type one", () => {
  assert.equal(stageTitle("Solar oven"), "Solar oven");
  assert.equal(stageTitle(""), EXAMPLE_BUILD);
});

test("the tour sends you to Club first, then to Inbox, then says it's done", () => {
  const fresh = { verified: false, accepted: false };
  assert.equal(tourHint("today", fresh).go, "club");
  assert.equal(tourHint("club", fresh).go, null, "already there: the hint is about the button");
  assert.match(tourHint("club", fresh).text, /Verify/);

  const signed = { verified: true, accepted: false };
  for (const p of PLACES.filter((x) => x.id !== "inbox")) assert.equal(tourHint(p.id, signed).go, "inbox", p.id);
  assert.equal(tourHint("inbox", signed).go, null);
  assert.match(tourHint("inbox", signed).text, /Accept/);

  const done = tourHint("proof", { verified: true, accepted: true });
  assert.equal(done.done, true);
  assert.equal(done.go, null);
  assert.equal(tourHint("today", fresh).done, false);
});

test("Ember's reply appears a whole word at a time and ends complete", () => {
  const text = "Two clubs match what you build.";
  assert.equal(typedSoFar(text, 0), "");
  assert.equal(typedSoFar(text, 2), "", "not half of the first word");
  assert.equal(typedSoFar(text, 6), "Two");
  assert.equal(typedSoFar(text, 11), "Two clubs");
  assert.equal(typedSoFar(text, text.length), text);
  assert.equal(typedSoFar(text, 999), text);
  for (let n = 0; n <= text.length; n++) assert.ok(text.startsWith(typedSoFar(text, n)));
});

test("every Ember example has something to check, a card and an action that waits", () => {
  assert.equal(new Set(EMBER_ASKS.map((a) => a.id)).size, EMBER_ASKS.length);
  for (const a of EMBER_ASKS) {
    for (const v of [a.ask, a.checked, a.reply, a.card.title, a.action, a.done]) assert.ok(v.trim().length > 2, a.id);
    assert.ok(a.card.lines.length > 0, a.id);
  }
});

test("company search matches the work, skills, club or name, and needs every word", () => {
  assert.equal(searchBuilders("").length, BUILDERS.length);
  assert.equal(searchBuilders("   ").length, BUILDERS.length);
  assert.deepEqual(searchBuilders("pcb").map((b) => b.id), ["theo"]);
  assert.deepEqual(searchBuilders("CRISPR").map((b) => b.id), ["ines"]);
  assert.deepEqual(searchBuilders("rocketry club").map((b) => b.id).sort(), ["ben", "maya"]);
  assert.deepEqual(searchBuilders("rocketry pcb"), [], "both words have to match the same person");
  assert.deepEqual(searchBuilders("blockchain"), []);
});

test("every suggested search finds someone, and everyone listed has signed work", () => {
  for (const t of SEARCH_TRIES) assert.ok(searchBuilders(t).length > 0, t);
  for (const b of BUILDERS) assert.ok(b.signed.length > 0 && b.signed.every((s) => s.by && s.club && s.when), b.id);
});
