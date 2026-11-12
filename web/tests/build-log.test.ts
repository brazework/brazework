// The project page's build log (Linear FIX-92): weekly activity, live status, one timeline, and the
// 30-second summary for someone hiring. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLog, inThirtySeconds, lastActivity, liveStatus, weeklyActivity } from "../src/lib/build-log";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const DAY = 864e5;

test("weekly activity: oldest week first, the newest week ends now, older and future times ignored", () => {
  const w = weeklyActivity([NOW - 1 * DAY, NOW - 2 * DAY, NOW - 8 * DAY, NOW - 83 * DAY, NOW - 90 * DAY, NOW + DAY], NOW, 12);
  assert.equal(w.length, 12);
  assert.deepEqual(w.slice(-2), [1, 2], "two this week, one last week");
  assert.equal(w[0], 1, "83 days ago is the 12th week back");
  assert.equal(w.reduce((a, b) => a + b, 0), 4, "90 days ago and the future don't count");
});

test("last activity is the newest real time; none is null", () => {
  assert.equal(lastActivity([NOW - DAY, null, undefined, NOW - 5 * DAY, Number.NaN]), NOW - DAY);
  assert.equal(lastActivity([null, undefined]), null);
});

test("live status: shipped when completed, building when active in the last 3 weeks, quiet otherwise", () => {
  assert.equal(liveStatus("completed", null, NOW), "shipped");
  assert.equal(liveStatus("in_progress", NOW - 2 * DAY, NOW), "building");
  assert.equal(liveStatus("in_progress", NOW - 30 * DAY, NOW), "quiet");
  assert.equal(liveStatus("in_progress", null, NOW), "quiet");
});

test("the log mixes updates and verified milestones, newest first; pending ones aren't in it", () => {
  const posts = [{ id: "p1", created_at: "2026-11-10T00:00:00Z" }, { id: "p2", created_at: "2026-11-01T00:00:00Z" }];
  const ms = [
    { id: "m1", title: "Static fire", reviewer_name: "Maya", community_name: "Rocketry", reviewed_at: "2026-11-05T00:00:00Z", achieved_on: "2026-11-02", status: "verified" },
    { id: "m2", title: "Pending one", reviewer_name: "", community_name: "Rocketry", reviewed_at: null, achieved_on: "2026-11-11", status: "pending" },
    { id: "m3", title: "No review time", reviewer_name: "Maya", community_name: "Rocketry", reviewed_at: null, achieved_on: "2026-10-20", status: "verified" },
  ];
  const log = buildLog(posts, ms);
  assert.deepEqual(log.map((e) => (e.kind === "post" ? e.post.id : e.milestone.id)), ["p1", "m1", "p2", "m3"]);
  assert.ok(log.every((e) => e.kind === "post" || e.milestone.status === "verified"));
});

test("in thirty seconds: who, what, the proof with who signed it, the momentum, the stack", () => {
  const lines = inThirtySeconds({
    owner: "Ben Cho", title: "Liquid engine test stand", summary: "A load-cell stand for static fires up to 2 kN.", status: "in_progress", teamSize: 2,
    verified: [{ title: "Static fire at 1.2 kN", reviewer: "Maya Patel", club: "Rocketry Club" }, { title: "Load cell calibrated", reviewer: "Ian", club: "Robotics Society" }],
    activeWeeks: 7, weeks: 12, updates: 9, tools: ["KiCad", "Python", "Fusion 360"],
  });
  assert.deepEqual(lines, [
    "Ben Cho and 1 teammate are building Liquid engine test stand: A load-cell stand for static fires up to 2 kN.",
    "2 milestones verified by Rocketry Club and Robotics Society, most recently \"Static fire at 1.2 kN\", signed by Maya Patel.",
    "Active 7 of the last 12 weeks, with 9 updates logged.",
    "Built with KiCad, Python and Fusion 360.",
  ]);
});

test("in thirty seconds, for a brand-new solo project: honest about having no proof yet", () => {
  const lines = inThirtySeconds({ owner: "Ada", title: "Rover", summary: "", status: "completed", teamSize: 1, verified: [], activeWeeks: 0, weeks: 12, updates: 0, tools: [] });
  assert.deepEqual(lines, ["Ada built Rover.", "No club-verified milestones yet."]);
});
