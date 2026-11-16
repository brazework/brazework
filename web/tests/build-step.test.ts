// A build card's one next step (lib/build-step.ts): what to do next on the way from built to signed.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { activeWeeks, buildPath, buildStage, nextBuildStep, weekSummary, weeklyActivity } from "@/lib/build-step";

test("the next step follows the build's real state", () => {
  assert.equal(nextBuildStep({ updates: 0, verified: 0, waiting: 0 }).kind, "log");
  assert.equal(nextBuildStep({ updates: 0, verified: 0, waiting: 0 }).label, "Log your first update");
  assert.equal(nextBuildStep({ updates: 2, verified: 0, waiting: 0 }).kind, "verify");
  assert.equal(nextBuildStep({ updates: 2, verified: 0, waiting: 0 }).label, "Get it verified");
  assert.equal(nextBuildStep({ updates: 2, verified: 0, waiting: 1 }).kind, "waiting");
  assert.equal(nextBuildStep({ updates: 2, verified: 3, waiting: 0 }).label, "Log an update");
  assert.equal(nextBuildStep({ updates: 0, verified: 1, waiting: 0 }).label, "Log an update", "already signed: keep it moving");
});

test("the stage a build has reached: built, then signed", () => {
  assert.equal(buildStage({ updates: 0, verified: 0, waiting: 0 }), 0);
  assert.equal(buildStage({ updates: 1, verified: 0, waiting: 0 }), 1);
  assert.equal(buildStage({ updates: 1, verified: 0, waiting: 2 }), 1);
  assert.equal(buildStage({ updates: 0, verified: 2, waiting: 0 }), 2);
});

test("a build's last twelve weeks: one count per week, the newest last", () => {
  const now = Date.parse("2026-11-16T12:00:00Z"), day = 86_400_000, at = (d: number) => new Date(now - d * day).toISOString();
  const w = weeklyActivity([at(0), at(1), at(6.9), at(7.1), at(20), at(83), at(84.5), at(400), "not a date"], now);
  assert.equal(w.length, 12);
  assert.equal(w.at(-1), 3, "today, yesterday and six days ago are this week");
  assert.equal(w.at(-2), 1, "seven days and a bit is last week");
  assert.equal(w.at(-3), 1, "twenty days ago");
  assert.equal(w[0], 1, "83 days ago is the oldest week shown");
  assert.equal(w.reduce((a, b) => a + b, 0), 6, "older than twelve weeks, and unreadable dates, are left out");
  assert.equal(activeWeeks(w), 4);
  assert.deepEqual(weeklyActivity([], now), Array(12).fill(0));
  assert.equal(weeklyActivity([new Date(now + day).toISOString()], now).at(-1), 1, "a clock a little ahead still counts as this week");
});

test("the path on a Build card: logged, asked, signed", () => {
  const done = (b: { updates: number; verified: number; waiting: number }) => buildPath(b).map((s) => s.done);
  assert.deepEqual(done({ updates: 0, verified: 0, waiting: 0 }), [false, false, false]);
  assert.deepEqual(done({ updates: 2, verified: 0, waiting: 0 }), [true, false, false]);
  assert.deepEqual(done({ updates: 1, verified: 0, waiting: 1 }), [true, true, false]);
  assert.deepEqual(done({ updates: 0, verified: 1, waiting: 0 }), [true, true, true], "a signed result means it was logged and asked for");
  const p = buildPath({ updates: 1, verified: 0, waiting: 1 });
  assert.deepEqual(p.map((s) => s.label), ["Logged", "Asked", "Signed"]);
  assert.equal(p[0].note, "1 update");
  assert.equal(p[1].note, "1 waiting");
  assert.equal(buildPath({ updates: 3, verified: 2, waiting: 0 })[2].note, "2 signed");
  assert.equal(buildPath({ updates: 0, verified: 1, waiting: 0 })[0].note, "1 result", "a result with no update still counts as logged, and says what it is");
  assert.equal(buildPath({ updates: 0, verified: 0, waiting: 0 })[0].note, "nothing yet");
});

test("the line above your builds adds them up", () => {
  const w = (last: number) => [...Array(11).fill(0), last];
  assert.deepEqual(weekSummary([{ updates: 3, verified: 1, waiting: 0, weeks: w(2) }, { updates: 1, verified: 0, waiting: 1, weeks: w(1) }]), { thisWeek: 3, signed: 1, waiting: 1 });
  assert.deepEqual(weekSummary([]), { thisWeek: 0, signed: 0, waiting: 0 });
});
