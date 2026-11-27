// Progress, the dashboard's first view: what a member logged, how much of it is verified and by whom,
// the tools behind it, and the sentences that say so. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgress, days, median, verifierKind, type MilestoneRow } from "@/lib/progress";

const DAY = 864e5;
const now = Date.UTC(2026, 10, 26, 12);
const ago = (d: number) => new Date(now - d * DAY).toISOString();
const since = now - 30 * DAY;
const buckets = [0, 7, 14, 21, 28].map((d) => new Date(since + d * DAY).toISOString().slice(0, 10));
const m = (o: Partial<MilestoneRow>): MilestoneRow => ({ created_at: ago(5), status: "pending", reviewed_at: null, reviewer_role: "", community_type: "field", project_id: "p1", ...o });
const base = { tools: {} as Record<string, string[]>, activity: [] as number[], buckets, since, now, period: "30 days", goal: null };

test("who verified: a vouch by its relationship, a class's faculty as professors, anyone else in a club as officers", () => {
  assert.equal(verifierKind({ reviewer_role: "manager", community_type: null }), "managers");
  assert.equal(verifierKind({ reviewer_role: "ta", community_type: null }), "professors");
  assert.equal(verifierKind({ reviewer_role: "owner", community_type: "class" }), "professors");
  assert.equal(verifierKind({ reviewer_role: "admin", community_type: "field" }), "officers");
});

test("days and the median read like a person would say them", () => {
  assert.equal(days(0.3), "less than a day");
  assert.equal(days(1), "1 day");
  assert.equal(days(2.4), "2.5 days");
  assert.equal(days(3), "3 days");
  assert.equal(median([]), null);
  assert.equal(median([4, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test("nothing logged: one sentence that says how to start, and empty numbers", () => {
  const p = buildProgress({ ...base, milestones: [] });
  assert.equal(p.everLogged, 0);
  assert.equal(p.share, null);
  assert.match(p.summary[0], /Nothing logged yet/);
});

test("a student: logged this month, verified by a professor and a club officer, with the typical wait", () => {
  const p = buildProgress({
    ...base,
    milestones: [
      m({ created_at: ago(10), status: "verified", reviewed_at: ago(8), reviewer_role: "owner", community_type: "class" }),
      m({ created_at: ago(6), status: "verified", reviewed_at: ago(5), reviewer_role: "admin" }),
      m({ created_at: ago(2) }),
      m({ created_at: ago(90), status: "verified", reviewed_at: ago(88), reviewer_role: "owner", community_type: "class" }),
    ],
  });
  assert.equal(p.logged, 3);
  assert.equal(p.verified, 2);
  assert.equal(p.share, 67);
  assert.equal(p.medianDays, 1.5);
  assert.equal(p.waiting, 1);
  assert.deepEqual(p.byKind.map((k) => [k.label, k.n]), [["Professors and TAs", 2], ["Club officers", 1]]);
  assert.equal(p.loggedSeries.reduce((n, x) => n + x.value, 0), 3);
  assert.equal(p.summary[0], "You logged 3 milestones in the last 30 days, and 2 are verified.");
  assert.equal(p.summary[1], "Verification took 1.5 days, typically, and 1 milestone waits for whoever saw it.");
});

test("a builder who isn't a student: vouched by a manager and a mentor, toward a goal", () => {
  const p = buildProgress({
    ...base,
    goal: { title: "Find a job (backend)", created_at: ago(20) },
    milestones: [
      m({ created_at: ago(15), status: "verified", reviewed_at: ago(12), reviewer_role: "manager", community_type: null }),
      m({ created_at: ago(40), status: "verified", reviewed_at: ago(25), reviewer_role: "mentor", community_type: null }),
    ],
  });
  assert.deepEqual(p.byKind.map((k) => k.label).sort(), ["Managers and coworkers", "Mentors"]);
  assert.equal(p.goal?.verified, 1);
  assert.equal(p.summary.at(-1), "1 verified milestone since you set your goal: Find a job (backend).");
});

test("tools: counted across milestones, and marked new when first used in this period", () => {
  const p = buildProgress({
    ...base,
    tools: { p1: ["Python", "ROS 2"], p2: ["SolidWorks", "Python"] },
    milestones: [m({ project_id: "p1", created_at: ago(60) }), m({ project_id: "p1" }), m({ project_id: "p2" })],
  });
  assert.deepEqual(p.tools.map((x) => [x.tool, x.n, x.fresh]), [["Python", 3, false], ["ROS 2", 2, false], ["SolidWorks", 1, true]]);
});

test("a quiet month still says what's there, and a streak shows when there's no goal", () => {
  const week = 7 * DAY;
  const p = buildProgress({ ...base, activity: [now - 1 * DAY, now - week, now - 2 * week], milestones: [m({ created_at: ago(70) })] });
  assert.equal(p.summary[0], "Nothing new logged in the last 30 days. You have 1 milestone in all.");
  assert.match(p.summary.at(-1)!, /weeks in a row/);
});
