// The record by year on a profile (lib/record-years.ts): when it's worth drawing, which work shows,
// for whom, and what each year's sentence says. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildYears, nameList } from "../src/lib/record-years";

const now = Date.parse("2026-11-21T15:00:00Z");
const projects = [
  { id: "p1", title: "Line follower" },
  { id: "p2", title: "Clinic scheduling" },
];
const ms = (id: string, project_id: string, achieved_on: string, status: string, extra = {}) => ({ id, project_id, title: `Result ${id}`, achieved_on, status, community_name: "Robotics Society", reviewer_name: "Maya Patel", ...extra });

test("one recent year is left to the 12-month chart", () => {
  assert.equal(buildYears({ now, own: true, projects, milestones: [ms("a", "p1", "2026-03-02", "verified"), ms("b", "p1", "2026-09-14", "verified")] }), null);
  assert.equal(buildYears({ now, own: true, projects, milestones: [] }), null);
});

test("a record that reaches into a second year is drawn, oldest first", () => {
  const y = buildYears({ now, own: false, projects, milestones: [ms("b", "p2", "2026-04-10", "verified", { vouched_by: "Sam Okafor, Operations Manager · northclinic.org" }), ms("a", "p1", "2024-05-01", "verified")] })!;
  assert.deepEqual(y.years.map((x) => x.year), [2024, 2026]);
  assert.equal(y.proven, 2);
  assert.equal(y.people, 2);
  assert.equal(y.from, 2024);
  assert.equal(y.to, 2026);
  assert.equal(y.earlier, null);
});

test("one year is enough when its work is older than the 12-month chart reaches", () => {
  const y = buildYears({ now, own: false, projects, milestones: [ms("a", "p1", "2023-05-01", "verified")] })!;
  assert.deepEqual(y.years.map((x) => x.year), [2023]);
  // Alone, it isn't called the start of anything.
  assert.equal(y.years[0].line, "1 result proven on Line follower. Signed by Maya Patel.");
});

test("each year's sentence comes from the record", () => {
  const y = buildYears({
    now, own: false, projects,
    milestones: [
      ms("a", "p1", "2024-02-01", "verified"),
      ms("b", "p1", "2025-03-01", "verified"),
      ms("c", "p2", "2025-06-01", "verified", { vouched_by: "Sam Okafor, Operations Manager · northclinic.org" }),
      ms("d", "p2", "2025-08-01", "logged", { backed: true }),
      ms("e", "p2", "2026-01-15", "verified", { vouched_by: "Dr. Elena Ruiz, Professor · hartford.edu" }),
    ],
  })!;
  assert.equal(y.years[0].line, "The record starts here: 1 result proven on Line follower. Signed by Maya Patel.");
  assert.equal(y.years[1].line, "3 results proven across 2 projects. Signed by Maya Patel and Sam Okafor. 1 backed by GitHub.");
  assert.equal(y.years[2].line, "So far this year: 1 result proven on Clinic scheduling. Signed by Dr. Elena Ruiz.");
  assert.deepEqual([y.years[1].signed, y.years[1].backed], [2, 1]);
  // The full "who signed" stays on the result; only the sentence shortens it.
  assert.equal(y.years[1].results[1].by, "Sam Okafor, Operations Manager · northclinic.org");
  assert.equal(y.years[1].results[0].by, "Maya Patel, Robotics Society");
  assert.equal(y.years[1].results[2].kind, "backed");
  assert.equal(y.years[1].results[2].by, undefined);
  assert.equal(y.years[1].results[0].href, "/projects/p1");
  assert.equal(y.years[1].results[0].when, "Mar 1");
});

test("waiting work shows to the owner only, and never counts as proven", () => {
  const input = { now, projects, milestones: [ms("a", "p1", "2024-02-01", "verified"), ms("b", "p1", "2026-02-01", "verified"), ms("c", "p1", "2026-05-01", "pending"), ms("d", "p2", "2022-05-01", "pending")] };
  const mine = buildYears({ ...input, own: true })!;
  // A year with only waiting work is a node on your own chart.
  assert.deepEqual(mine.years.map((x) => x.year), [2022, 2024, 2026]);
  assert.equal(mine.years[0].line, "1 result waiting to be signed.");
  assert.equal(mine.years[0].size, 0);
  assert.equal(mine.years[2].waiting, 1);
  assert.equal(mine.proven, 2);
  assert.ok(!mine.years.flatMap((x) => x.results).some((r) => r.id === "c" || r.id === "d"));

  const theirs = buildYears({ ...input, own: false })!;
  assert.deepEqual(theirs.years.map((x) => x.year), [2024, 2026]);
  assert.equal(theirs.years[1].waiting, 0);
  assert.equal(theirs.proven, 2);
});

test("waiting work alone doesn't make a chart", () => {
  assert.equal(buildYears({ now, own: true, projects, milestones: [ms("a", "p1", "2022-02-01", "pending"), ms("b", "p1", "2026-02-01", "verified")] }), null);
});

test("only signed, backed and (for the owner) waiting work is drawn", () => {
  const y = buildYears({
    now, own: true, projects,
    milestones: [
      ms("a", "p1", "2023-02-01", "verified"),
      ms("b", "p1", "2026-02-01", "verified"),
      ms("draft", "p1", "2025-02-01", "draft"),
      ms("declined", "p1", "2025-03-01", "declined"),
      ms("revoked", "p1", "2025-04-01", "revoked"),
      ms("logged", "p1", "2025-05-01", "logged"), // logged with nothing behind it
      ms("hidden", "p9", "2025-06-01", "verified"), // a project this viewer can't see
      ms("future", "p1", "2027-06-01", "verified"),
      ms("nodate", "p1", "", "verified"),
    ],
  })!;
  assert.deepEqual(y.years.map((x) => x.year), [2023, 2026]);
  assert.equal(y.proven, 2);
});

test("a skipped year dashes the line; the fullest year is the biggest node", () => {
  const y = buildYears({ now, own: false, projects, milestones: [ms("a", "p1", "2022-02-01", "verified"), ms("b", "p1", "2023-02-01", "verified"), ms("c", "p1", "2023-03-01", "verified"), ms("d", "p1", "2023-04-01", "verified"), ms("e", "p1", "2023-05-01", "verified"), ms("f", "p1", "2026-02-01", "verified")] })!;
  assert.deepEqual(y.years.map((x) => x.gap), [false, false, true]);
  assert.equal(y.years[1].size, 1);
  assert.equal(y.years[0].size, 0.5); // a quarter of the work: half the width
});

test("a year lists four results and counts the rest", () => {
  const y = buildYears({ now, own: false, projects, milestones: [ms("old", "p1", "2024-01-01", "verified"), ...Array.from({ length: 6 }, (_, i) => ms(`m${i}`, "p1", `2025-0${i + 1}-10`, "verified"))] })!;
  assert.equal(y.years[1].results.length, 4);
  assert.equal(y.years[1].more, 2);
  // In the order it happened.
  assert.deepEqual(y.years[1].results.map((r) => r.id), ["m0", "m1", "m2", "m3"]);
});

test("more than eight years: the latest eight are drawn and the rest are counted", () => {
  const y = buildYears({ now, own: false, projects, milestones: Array.from({ length: 11 }, (_, i) => ms(`m${i}`, "p1", `${2016 + i}-06-01`, "verified")) })!;
  assert.equal(y.years.length, 8);
  // The header's span covers the whole record; the nodes start at 2019.
  assert.equal(y.from, 2016);
  assert.equal(y.to, 2026);
  assert.equal(y.years[0].year, 2019);
  assert.deepEqual(y.earlier, { results: 3, before: 2019 });
  assert.equal(y.proven, 11);
  // The first node drawn isn't the start of the record, so it doesn't say it is.
  assert.ok(!y.years[0].line.startsWith("The record starts here"));
});

test("names in a sentence", () => {
  assert.equal(nameList(["Ana"]), "Ana");
  assert.equal(nameList(["Ana", "Ben"]), "Ana and Ben");
  assert.equal(nameList(["Ana", "Ben", "Cy"]), "Ana, Ben and 1 other");
  assert.equal(nameList(["Ana", "Ben", "Cy", "Di"]), "Ana, Ben and 2 others");
});
