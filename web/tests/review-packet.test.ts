// The review packet (lib/review-packet.ts) and its plan flag (lib/plans.ts): the date range is sane,
// each item says who signed it in what role, and moving the feature between free and Plus is one word.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { accessLabel, canUse, FEATURE_ACCESS } from "@/lib/plans";
import { packetLinks, packetRange, packetSigner, packetSummary } from "@/lib/review-packet";

const today = new Date("2026-11-19T15:00:00Z");

test("the range defaults to the last 12 months", () => {
  assert.deepEqual(packetRange(undefined, undefined, today), { from: "2025-11-20", to: "2026-11-19" });
});

test("a range from the URL is kept; nonsense, backwards and too long ones are fixed", () => {
  assert.deepEqual(packetRange("2026-01-01", "2026-06-30", today), { from: "2026-01-01", to: "2026-06-30" });
  assert.deepEqual(packetRange("not-a-date", "2026-06-30", today), { from: "2025-07-01", to: "2026-06-30" });
  assert.deepEqual(packetRange("2026-08-01", "2026-06-30", today), { from: "2026-06-30", to: "2026-06-30" });
  assert.deepEqual(packetRange("2001-01-01", "2026-06-30", today), { from: "2021-06-30", to: "2026-06-30" });
});

test("who signed, in their role", () => {
  assert.equal(packetSigner({ vouched_by: "Dr. Priya Lee, Assistant Professor · utexas.edu", reviewer_name: "Dr. Priya Lee", reviewer_role: "professor", community_name: "" }),
    "Dr. Priya Lee, Assistant Professor · utexas.edu (professor)");
  assert.equal(packetSigner({ vouched_by: "", reviewer_name: "Maya P.", reviewer_role: "admin", community_name: "Rocketry Club" }), "Maya P., club officer of Rocketry Club");
});

test("evidence: https links only, no repeats", () => {
  assert.deepEqual(packetLinks({ evidence: "https://a.test/1", evidence_items: [{ type: "link", url: "https://a.test/1" }, { type: "commit", url: "https://github.com/x/y/commit/1" }, { type: "image" }] }),
    ["https://a.test/1", "https://github.com/x/y/commit/1"]);
});

test("the summary counts milestones, projects and people", () => {
  assert.equal(packetSummary([]), "No signed milestones in this period.");
  assert.equal(packetSummary([{ project_id: "p1", vouched_by: "", reviewer_name: "Maya P." }, { project_id: "p2", vouched_by: "Dr. Lee · utexas.edu", reviewer_name: "Dr. Lee" }, { project_id: "p1", vouched_by: "", reviewer_name: "Maya P." }]),
    "3 signed milestones across 2 projects, signed by 2 people");
});

test("the plan flag: preview is open to everyone and labelled; plus is closed until billing; free is plain", () => {
  const me = { id: "u1" };
  assert.equal(FEATURE_ACCESS.reviewPacket, "plus-preview", "ships as a labelled Plus preview");
  assert.equal(canUse("reviewPacket", me), true);
  assert.equal(accessLabel("reviewPacket"), "Plus preview: free while Plus is coming");
  assert.equal(canUse("reviewPacket", me, { reviewPacket: "plus" }), false, "nobody has Plus until billing exists");
  assert.equal(canUse("reviewPacket", me, { reviewPacket: "free" }), true);
  assert.equal(accessLabel("reviewPacket", { reviewPacket: "free" }), null);
});
