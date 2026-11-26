// Brazework Courses arithmetic (lib/course-math.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { dueText, gradebook, gradesCsv, isLate, rubricFromForm } from "@/lib/course-math";

test("late is after the due date, and never without one", () => {
  assert.equal(isLate("2026-12-02T10:00:00Z", "2026-12-01T23:59:00Z"), true);
  assert.equal(isLate("2026-12-01T20:00:00Z", "2026-12-01T23:59:00Z"), false);
  assert.equal(isLate("2026-12-02T10:00:00Z", null), false);
  assert.equal(isLate(null, "2026-12-01T23:59:00Z"), false);
});

test("due dates read like a person would say them", () => {
  const now = new Date(2026, 10, 26, 9, 0).getTime();
  assert.equal(dueText(null, now), "No due date");
  assert.equal(dueText(new Date(2026, 10, 26, 23, 59).toISOString(), now), "Due today");
  assert.equal(dueText(new Date(2026, 10, 27, 12, 0).toISOString(), now), "Due tomorrow");
  assert.equal(dueText(new Date(2026, 10, 30, 12, 0).toISOString(), now), "Due in 4 days");
  assert.equal(dueText(new Date(2026, 10, 24, 12, 0).toISOString(), now), "Was due 2 days ago");
  assert.equal(dueText(new Date(2026, 10, 26, 8, 0).toISOString(), now), "Was due today");
});

test("the rubric comes from the form's rows, skipping empty ones", () => {
  const f = new FormData();
  f.set("criterion_0", " Analysis "); f.set("points_0", "40"); f.set("outcome_0", "1");
  f.set("criterion_1", ""); f.set("points_1", "10");
  f.set("criterion_2", "Writing"); f.set("points_2", "-3"); f.set("outcome_2", "9");
  assert.deepEqual(rubricFromForm(f), [
    { id: "r1", criterion: "Analysis", points: 40, outcome: "1" },
    { id: "r3", criterion: "Writing", points: 0 },
  ]);
});

test("the gradebook totals graded work only, and a group's submission counts for each teammate", () => {
  const assignments = [
    { id: "a1", title: "Memo", points: 50, due_at: "2026-12-01T00:00:00Z", published: true },
    { id: "a2", title: "Demo", points: 100, due_at: "2026-12-10T00:00:00Z", published: true, group_work: true },
    { id: "a3", title: "Draft", points: 10, due_at: null, published: false },
  ];
  const rows = gradebook(
    [{ uid: "ben", name: "Ben Cho", email: "ben@u.edu" }, { uid: "leo", name: "Leo Park", email: "leo@u.edu" }],
    assignments,
    [{ assignment_id: "a1", uid: "ben", score: 45, released: true }, { assignment_id: "a2", uid: "ben", score: 92, released: false }, { assignment_id: "a2", uid: "leo", score: 92, released: false }],
    [{ assignment_id: "a1", uid: "ben", submitted_at: "2026-12-02T00:00:00Z" }, { assignment_id: "a2", uid: "ben", project_id: "p1", submitted_at: "2026-12-09T00:00:00Z" }],
    new Map([["p1", ["ben", "leo"]]]),
  );
  assert.equal(rows[0].cells.length, 2, "only published assignments");
  assert.deepEqual([rows[0].earned, rows[0].possible, rows[0].percent], [137, 150, 91.3]);
  assert.equal(rows[0].cells[0].late, true);
  assert.equal(rows[1].cells[1].submitted, true, "Leo's group handed in the demo");
  assert.equal(rows[1].cells[0].submitted, false);
  assert.deepEqual([rows[1].earned, rows[1].possible, rows[1].percent], [92, 100, 92]);

  const csv = gradesCsv(rows, assignments).split("\n");
  assert.equal(csv[0], "Student,Email,Memo (50),Demo (100),Total,Percent");
  assert.equal(csv[1], "Ben Cho,ben@u.edu,45,92,137/150,91.3");
  assert.equal(csv[2], "Leo Park,leo@u.edu,,92,92/100,92");
});

test("CSV cells are quoted and formulas neutralised", () => {
  const csv = gradesCsv([{ uid: "x", name: "=HYPERLINK(\"x\")", email: "a,b", cells: [], earned: 0, possible: 0, percent: null }], []);
  assert.equal(csv.split("\n")[1], `"'=HYPERLINK(""x"")","a,b",0/0,`);
});
