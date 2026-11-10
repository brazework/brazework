// The build streak counts weeks in a row with work shown, keeps last week's streak alive until you
// post this week, and forgives one missed week. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStreak, weekStart } from "@/lib/streak";

const WEEK = 7 * 864e5;
const now = Date.UTC(2026, 10, 12, 15); // Thursday 12 Nov 2026
const thisMon = Date.UTC(2026, 10, 9);
const weeksAgo = (n: number, extraDays = 1) => thisMon - n * WEEK + extraDays * 864e5;

test("weeks start on Monday, UTC", () => {
  assert.equal(weekStart(now), thisMon);
  assert.equal(weekStart(thisMon), thisMon);
  assert.equal(weekStart(thisMon - 1), thisMon - WEEK); // Sunday night belongs to the week before
});

test("no work, no streak", () => {
  assert.deepEqual(buildStreak([], now), { weeks: 0, thisWeek: false, forgiven: false });
});

test("three weeks in a row, including this one", () => {
  assert.deepEqual(buildStreak([weeksAgo(0), weeksAgo(1), weeksAgo(2), weeksAgo(2, 3)], now), { weeks: 3, thisWeek: true, forgiven: false });
});

test("this week doesn't count yet, but last week's streak is still alive", () => {
  assert.deepEqual(buildStreak([weeksAgo(1), weeksAgo(2)], now), { weeks: 2, thisWeek: false, forgiven: false });
});

test("a streak that ended two weeks ago is over", () => {
  assert.equal(buildStreak([weeksAgo(2), weeksAgo(3)], now).weeks, 0);
});

test("one missed week is forgiven, a second one ends it", () => {
  // Active: this week, 1, (gap 2), 3, 4, (gap 5), 6
  const s = buildStreak([weeksAgo(0), weeksAgo(1), weeksAgo(3), weeksAgo(4), weeksAgo(6)], now);
  assert.deepEqual(s, { weeks: 4, thisWeek: true, forgiven: true });
});

test("future timestamps don't count", () => {
  assert.equal(buildStreak([now + WEEK], now).weeks, 0);
});
