// A project's milestone log on a profile folds to one line (Linear FIX-240): what that line says,
// which milestone shows under it, when your own log starts open, and #milestone-… links. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { anchoredMilestone, latestSigned, logFolds, logSummary, milestoneAnchor } from "@/lib/milestone-log";

const now = new Date("2026-11-22T12:00:00Z");
const ms = (id: string, status: string, achieved_on: string) => ({ id, status, achieved_on });
const log = [
  ms("a", "verified", "2026-11-02"),
  ms("b", "logged", "2026-11-18"),
  ms("c", "verified", "2026-10-30"),
  ms("d", "pending", "2026-09-01"),
  ms("e", "verified", "2026-11-10"),
];

test("the summary counts milestones and signed ones, and names the latest day", () => {
  assert.equal(logSummary(log, now), "5 milestones · 3 signed · latest Nov 18");
});

test("backed by GitHub and waiting don't count as signed; with none signed, it says nothing about signing", () => {
  assert.equal(logSummary([ms("x", "logged", "2026-03-04"), ms("y", "pending", "2026-03-01")], now), "2 milestones · latest Mar 4");
});

test("one milestone is singular, and a past year is spelled out", () => {
  assert.equal(logSummary([ms("x", "verified", "2025-06-09")], now), "1 milestone · 1 signed · latest Jun 9, 2025");
  assert.equal(logSummary([], now), "");
});

test("the milestone shown under the summary is the most recent signed one, never a waiting or backed one", () => {
  assert.equal(latestSigned(log)?.id, "e");
  assert.equal(latestSigned([ms("x", "logged", "2026-11-20"), ms("y", "pending", "2026-11-21")]), null);
});

test("only the owner sees the waiting count in the summary", () => {
  assert.equal(logSummary(log, now, true), "5 milestones · 3 signed · 1 waiting · latest Nov 18");
  assert.equal(logSummary(log, now), "5 milestones · 3 signed · latest Nov 18");
});

test("a single milestone isn't folded under a summary of itself", () => {
  assert.equal(logFolds([ms("x", "verified", "2026-01-01")]), false);
  assert.equal(logFolds(log), true);
});

test("a #milestone-… link names its milestone, and other hashes name none", () => {
  assert.equal(milestoneAnchor("m1"), "milestone-m1");
  assert.equal(anchoredMilestone(`#${milestoneAnchor("4f4c-9e")}`), "4f4c-9e");
  assert.equal(anchoredMilestone("#projects"), null);
  assert.equal(anchoredMilestone("#milestone-%ZZ"), null);
  assert.equal(anchoredMilestone(""), null);
});
