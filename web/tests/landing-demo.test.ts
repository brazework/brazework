// The landing page's demos (lib/landing-demo.ts): the tour's guidance follows what the visitor has
// done, Ember's reply is written out in whole words, and the company search only finds signed work.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILDERS, EMBER_ASKS, EXAMPLE_BUILD, PLACES, SEARCH_TRIES, heroRecord, searchBuilders, shortName, stageTitle, tourHint, typedSoFar } from "@/lib/landing-demo";

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

test("a signer is named the way the app names people: first name, last initial", () => {
  assert.equal(shortName("Ben Cho"), "Ben C.");
  assert.equal(shortName("Maria Gómez"), "Maria G.");
  assert.equal(shortName("Cher"), "Cher");
});

test("the hero's title block follows the story: drafting, waiting, then on the record and found", () => {
  const at = (phase: "typing" | "reading" | "draft" | "sent", step: number) =>
    Object.fromEntries(heroRecord({ phase, step, signer: "Ben Cho", finder: "Acme Aerospace", today: "Nov 19" }).map((c) => [c.label, c]));
  const typing = at("typing", 1);
  assert.deepEqual(Object.keys(typing), ["Status", "Signed by", "Signed on", "Found by"]);
  assert.equal(typing.Status.value, "Drafting");
  assert.equal(at("draft", 1).Status.value, "Draft");
  for (const label of ["Signed by", "Signed on", "Found by"]) assert.equal(typing[label].tone, "empty", label);

  const waiting = at("sent", 1);
  assert.equal(waiting.Status.value, "Waiting");
  assert.equal(waiting.Status.tone, "waiting", "asked but not signed: never green");
  assert.equal(waiting["Signed by"].tone, "empty");

  const signed = at("sent", 2);
  assert.equal(signed.Status.value, "On the record");
  assert.equal(signed.Status.tone, "ok", "green only once a person signed");
  assert.equal(signed["Signed by"].value, "Ben C.");
  assert.equal(signed["Signed on"].value, "Nov 19");
  assert.equal(signed["Found by"].tone, "empty");

  assert.equal(at("sent", 3)["Found by"].value, "Acme Aerospace");
  // Only the status is ever green, and none of the values repeat the demo's own words (the journey finds those exactly).
  for (const c of heroRecord({ phase: "sent", step: 3, signer: "Dana Ruiz", finder: "Brightline", today: "Nov 19" })) {
    if (c.label !== "Status") assert.notEqual(c.tone, "ok", c.label);
    assert.ok(!["Signed", "Verified", "Dana Ruiz"].includes(c.value), c.value);
  }
});

test("the hero tells seven different ways of working, each named once, the student's first", async () => {
  const { HERO_STORIES } = await import("@/lib/landing-demo");
  assert.equal(HERO_STORIES.length, 7);
  assert.equal(HERO_STORIES[0].who, "Student", "the visitor's own line uses the first story");
  assert.equal(HERO_STORIES[0].title, undefined, "the first one's title is the visitor's build");
  assert.equal(new Set(HERO_STORIES.map((s) => s.who)).size, 7, "one story per way of working");
  assert.equal(new Set(HERO_STORIES.map((s) => s.signer.name)).size, 7, "a different person signs each");
  for (const s of HERO_STORIES.slice(1)) assert.ok(s.title && s.title.length <= 60, s.who);
});

test("every story fits the card: a short ask, one or two proofs, and someone who signs and someone who asks", async () => {
  const { HERO_STORIES } = await import("@/lib/landing-demo");
  for (const s of HERO_STORIES) {
    assert.ok(s.cmd.length <= 56, `${s.who}: the typed ask fits one line`);
    assert.ok(s.proof.length >= 1 && s.proof.length <= 2, s.who);
    assert.ok(s.reads.length >= 1 && s.reads.length <= 2 && s.reads.every((r) => r.length <= 40), `${s.who}: what the AI read fits two short lines`);
    assert.ok(s.reply.length <= 90 && s.reply.endsWith("?"), `${s.who}: the AI's reply is short and asks before sending`);
    assert.ok(s.tool.length <= 24, `${s.who}: the chip's tool label stays short`);
    assert.ok(s.signer.name && s.signer.role && s.signer.act && s.signer.done, s.who);
    assert.ok(s.finder.name && s.finder.role && s.finder.ask.endsWith("?"), `${s.who}: the finder asks`);
  }
});
