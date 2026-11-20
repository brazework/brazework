// The record timeline on a profile (lib/record-timeline.ts): which work shows, for whom, and where it
// sits on the time axis. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTimeline } from "../src/lib/record-timeline";

const DAY = 864e5;
const now = Date.parse("2026-11-19T15:00:00Z");
const ago = (d: number) => new Date(now - d * DAY).toISOString().slice(0, 10);
const projects = [
  { id: "p1", title: "Crop disease classifier", status: "in_progress" },
  { id: "p2", title: "Field app", status: "done" },
];
const ms = (id: string, project_id: string, days: number, status: string, extra = {}) => ({ id, project_id, title: `Result ${id}`, achieved_on: ago(days), status, community_name: "Robotics Society", reviewer_name: "Maya Patel", ...extra });

test("nothing to draw without signed or waiting work", () => {
  assert.equal(buildTimeline({ now, projects, milestones: [], posts: [{ created_at: new Date(now).toISOString(), project_id: "p1" }], own: true }), null);
});

test("signed work shows to everyone; waiting work only to the owner", () => {
  const input = { now, projects, posts: [], milestones: [ms("a", "p1", 40, "verified"), ms("b", "p1", 2, "pending"), ms("c", "p1", 5, "declined")] };
  const mine = buildTimeline({ ...input, own: true })!;
  assert.deepEqual(mine.lanes[0].marks.map((m) => m.kind), ["signed", "waiting"]);
  assert.equal(mine.signed, 1);
  assert.equal(mine.waiting, 1);
  const theirs = buildTimeline({ ...input, own: false })!;
  assert.deepEqual(theirs.lanes[0].marks.map((m) => m.kind), ["signed"]);
  assert.equal(theirs.waiting, 0);
});

test("a project with only a waiting result has no lane for visitors", () => {
  const t = buildTimeline({ now, projects, posts: [], own: false, milestones: [ms("a", "p1", 10, "verified"), ms("b", "p2", 3, "pending")] })!;
  assert.deepEqual(t.lanes.map((l) => l.id), ["p1"]);
});

test("marks sit in time order inside the frame, and an ongoing project runs to today", () => {
  const t = buildTimeline({ now, projects, own: true, posts: [{ created_at: new Date(now - 20 * DAY).toISOString(), project_id: "p1" }], milestones: [ms("a", "p1", 60, "verified"), ms("b", "p1", 1, "verified")] })!;
  const xs = t.lanes[0].marks.map((m) => m.x);
  assert.deepEqual([...xs].sort((a, b) => a - b), xs);
  for (const x of xs) assert.ok(x > 0 && x < 1, `x=${x} inside the frame`);
  assert.equal(t.lanes[0].ongoing, true);
  assert.equal(t.lanes[0].to, t.today);
  assert.ok(t.lanes[0].from <= xs[0]);
});

test("a finished project's lane stops at its last result", () => {
  const t = buildTimeline({ now, projects, own: true, posts: [], milestones: [ms("a", "p2", 90, "verified"), ms("b", "p2", 30, "verified")] })!;
  const lane = t.lanes[0];
  assert.equal(lane.ongoing, false);
  assert.equal(lane.to, lane.marks[lane.marks.length - 1].x);
});

test("new members get a short window in weeks, long records a year in months", () => {
  const short = buildTimeline({ now, projects, own: true, posts: [], milestones: [ms("a", "p1", 6, "verified")] })!;
  assert.ok(short.end - short.start >= 21 * DAY - 1, "at least three weeks");
  assert.ok(short.lanes[0].marks[0].x < 0.8, "a week-old result sits well left of today");
  assert.ok(short.ticks.length >= 2 && short.ticks.length <= 7);
  assert.match(short.ticks[0].label, /^[A-Z][a-z]{2} \d{1,2}$/);
  const long = buildTimeline({ now, projects, own: true, posts: [], milestones: [ms("a", "p1", 300, "verified"), ms("b", "p1", 500, "verified")] })!;
  assert.ok(long.end - long.start <= 366 * DAY + 1, "a year at most");
  assert.ok(long.ticks.every((t) => /^[A-Z][a-z]{2}( \d{4})?$/.test(t.label)));
  assert.equal(long.signed, 1, "work older than a year is left off the chart");
});

test("at most four lanes, most recent first, and the rest counted", () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, title: `P${i}`, status: "done" }));
  const t = buildTimeline({ now, projects: many, own: false, posts: [], milestones: many.map((p, i) => ms(`m${i}`, p.id, 10 + i * 10, "verified")) })!;
  assert.deepEqual(t.lanes.map((l) => l.id), ["q0", "q1", "q2", "q3"]);
  assert.equal(t.more, 2);
});

test("the summary names when the signed record starts", () => {
  const t = buildTimeline({ now, projects, own: false, posts: [], milestones: [ms("a", "p1", 200, "verified"), ms("b", "p2", 30, "verified", { vouched_by: "Dr. Ruiz" })] })!;
  assert.equal(t.since, "May 2026");
  assert.equal(t.lanes.find((l) => l.id === "p2")!.marks[0].by, "Dr. Ruiz");
  assert.equal(t.lanes.find((l) => l.id === "p1")!.marks[0].by, "Maya Patel, Robotics Society");
});

test("work backed by GitHub is on the chart for everyone, counted apart from signed work", () => {
  const input = { now, projects, posts: [], milestones: [
    ms("a", "p1", 40, "verified"),
    ms("b", "p1", 20, "logged", { backed: true }),
    ms("c", "p1", 10, "logged"),
    ms("d", "p1", 2, "pending"),
  ] };
  const theirs = buildTimeline({ ...input, own: false })!;
  assert.deepEqual(theirs.lanes[0].marks.map((m) => m.kind), ["signed", "backed"], "a visitor sees signed and backed; logged with no backing and waiting stay out");
  assert.equal(theirs.signed, 1);
  assert.equal(theirs.backed, 1);
  const mine = buildTimeline({ ...input, own: true })!;
  assert.deepEqual(mine.lanes[0].marks.map((m) => m.kind), ["signed", "backed", "waiting"]);
  assert.equal(mine.waiting, 1);
  // Backed work alone is a record worth drawing; it's never counted as signed.
  const only = buildTimeline({ now, projects, posts: [], milestones: [ms("b", "p1", 20, "logged", { backed: true })], own: false })!;
  assert.equal(only.signed, 0);
  assert.equal(only.backed, 1);
  assert.equal(only.since, null, "\"signed since\" is only about signatures");
});
