// Torch starts a club or a study group (lib/torch-club.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clubForm, cleanClubDraft } from "../src/lib/torch-club";
import { ALL_TOPICS } from "../src/lib/forge";

const NOV = Date.UTC(2026, 10, 26);

test("a club needs a name and what it's for", () => {
  assert.deepEqual(cleanClubDraft({ name: "ab", about: "x" }, NOV), { error: "A club needs a name of at least 3 characters." });
  assert.deepEqual(cleanClubDraft({ name: "Rocketry", about: "  " }, NOV), { error: "Add a sentence about what the club is for." });
});

test("a plain club: public, a field community, unknown field and topics dropped", () => {
  const d = cleanClubDraft({ name: "  Solar   Car  Team ", about: "We build a solar car.", field: "underwater basket weaving", topics: [ALL_TOPICS[0], "not a topic", ALL_TOPICS[0]] }, NOV);
  assert.ok(!("error" in d));
  assert.equal(d.name, "Solar Car Team");
  assert.equal(d.club_type, "field");
  assert.equal(d.privacy, "public");
  assert.equal(d.field, "Any field");
  assert.deepEqual(d.topics, [ALL_TOPICS[0]]);
  assert.equal(d.course, "");
  assert.equal(d.term, "");
});

test("a study group needs its course, and its term defaults to this one", () => {
  assert.match((cleanClubDraft({ name: "Orgo crew", about: "Weekly problem sets.", type: "study" }, NOV) as { error: string }).error, /course/);
  const d = cleanClubDraft({ name: "Orgo crew", about: "Weekly problem sets.", type: "study", course: "CHEM 201", meets: "Tuesdays 7pm, Library 3", privacy: "approval" }, NOV);
  assert.ok(!("error" in d));
  assert.equal(d.term, "Fall 2026");
  assert.equal(d.privacy, "approval");
  const f = clubForm(d);
  assert.equal(f.get("type"), "study");
  assert.equal(f.get("course"), "CHEM 201");
  assert.equal(f.get("meets"), "Tuesdays 7pm, Library 3");
});

test("a school community isn't something Torch starts: it falls back to a field community", () => {
  const d = cleanClubDraft({ name: "State alumni", about: "Alumni of State.", type: "school" }, NOV);
  assert.ok(!("error" in d));
  assert.equal(d.club_type, "field");
  assert.equal(clubForm(d).get("course"), null);
});
