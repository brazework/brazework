// One-tap Ember actions (lib/copilot-presets.ts): the member sees a plain request; Ember's instructions
// travel separately and only for real club ids. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clubUpdateAsk, clubUpdateHref, clubUpdatePreset, presetFromQuery, presetInstruction, presetSchema } from "../src/lib/copilot-presets";
import { copilotRequest } from "../src/lib/copilot-request";

test("what the member sees is a plain request, never Ember's instructions", () => {
  const ask = clubUpdateAsk("Rocketry Club");
  assert.equal(ask, "Draft this week's update for Rocketry Club");
  assert.doesNotMatch(ask, /club_report|propose_|club id/);
  assert.equal(clubUpdateAsk("   "), "Draft this week's update for my club");
});

test("the instructions name the club and the tools, and say what to do without access", () => {
  const i = presetInstruction(clubUpdatePreset("rkt"));
  assert.match(i, /club_report for club rkt/);
  assert.match(i, /propose_club_post/);
  assert.match(i, /can't see this club's report/);
});

test("club ids are checked: odd characters, empty or overlong ids are refused", () => {
  assert.equal(presetSchema.safeParse({ kind: "club_update", club_id: "rkt" }).success, true);
  for (const bad of ["", "a b", "rkt; drop", "x".repeat(65), "../../etc"]) assert.equal(presetSchema.safeParse({ kind: "club_update", club_id: bad }).success, false, bad);
  assert.equal(presetSchema.safeParse({ kind: "something_else", club_id: "rkt" }).success, false);
});

test("a request may carry a preset; a malformed preset is a bad request", () => {
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "Draft this week's update for Rocketry Club", preset: { kind: "club_update", club_id: "rkt" } }).success, true);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "Hi" }).success, true);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "Hi", preset: { kind: "club_update", club_id: "bad id" } }).success, false);
});

test("the Ember page link round-trips: the question shows plainly and the club comes back as a preset", () => {
  const href = clubUpdateHref("rkt", "Rocketry Club");
  const u = new URL(href, "https://brazework.com");
  assert.equal(u.searchParams.get("q"), "Draft this week's update for Rocketry Club");
  assert.deepEqual(presetFromQuery(Object.fromEntries(u.searchParams)), { kind: "club_update", club_id: "rkt" });
  assert.equal(presetFromQuery({ q: "hi" }), null);
  assert.equal(presetFromQuery({ club_update: "not ok!" }), null);
  assert.equal(presetFromQuery({ club_update: ["rkt", "x"] }), null);
});
