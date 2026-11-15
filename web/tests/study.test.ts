// Study groups (lib/study.ts): the term a date falls in, the group's line, who led it. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmedBy, currentTerm, leadCounts, ledTitle, studyLine, studyProof } from "../src/lib/study";

test("the term a date falls in, the way students say it", () => {
  assert.equal(currentTerm(Date.parse("2027-02-10T12:00:00Z")), "Spring 2027");
  assert.equal(currentTerm(Date.parse("2027-06-15T12:00:00Z")), "Summer 2027");
  assert.equal(currentTerm(Date.parse("2026-11-15T12:00:00Z")), "Fall 2026");
});

test("a study group's line leaves out what's empty", () => {
  assert.equal(studyLine({ course: "CHEM 201", term: "Spring 2027", meets: "Tuesdays 7pm" }), "CHEM 201 · Spring 2027 · Meets Tuesdays 7pm");
  assert.equal(studyLine({ course: "CHEM 201" }), "CHEM 201");
  assert.equal(studyLine({}), "");
});

test("who led it: counts per leader, and whether you confirmed", () => {
  const rows = [
    { community_id: "g", leader: "ben", confirmed_by: "maya", created_at: "2027-02-01" },
    { community_id: "g", leader: "ben", confirmed_by: "cara", created_at: "2027-02-02" },
    { community_id: "g", leader: "cara", confirmed_by: "ben", created_at: "2027-02-03" },
  ];
  const c = leadCounts(rows, "maya");
  assert.deepEqual(c.get("ben"), { n: 2, mine: true });
  assert.deepEqual(c.get("cara"), { n: 1, mine: false });
});

test("on a profile: one line per group led, newest first", () => {
  const p = studyProof([
    { community_id: "a", leader: "ben", confirmed_by: "maya", created_at: "2026-10-01", communities: { name: "Calc crew", course: "", term: "Fall 2026" } },
    { community_id: "b", leader: "ben", confirmed_by: "maya", created_at: "2027-02-01", communities: [{ name: "Orgo", course: "CHEM 201", term: "Spring 2027" }] },
    { community_id: "b", leader: "ben", confirmed_by: "cara", created_at: "2027-03-01", communities: { name: "Orgo", course: "CHEM 201", term: "Spring 2027" } },
    { community_id: "c", leader: "ben", confirmed_by: "cara", created_at: "2027-03-02", communities: null },
  ]);
  assert.deepEqual(p.map((s) => [s.community_id, s.n, s.last]), [["b", 2, "2027-03-01"], ["a", 1, "2026-10-01"]]);
  assert.equal(ledTitle(p[0]), "Led the CHEM 201 study group");
  assert.equal(ledTitle(p[1]), "Led Calc crew");
  assert.equal(confirmedBy(1), "Confirmed by 1 member");
  assert.equal(confirmedBy(4), "Confirmed by 4 members");
});
