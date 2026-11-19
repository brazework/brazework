// The goal over MCP (lib/mcp-goal.ts) and goal-aware prompts: the progress line and next step come from
// the app's own goalPath(), work that fits the goal ranks first, prompts say why each draft matters and
// stay honest, and with no goal they offer one once. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { goalPath } from "@/lib/goals";
import { goalSummary, relevance, type GoalRead } from "@/lib/mcp-goal";
import { goalLine, promptText } from "@/lib/mcp-playbooks";

const base: GoalRead = {
  goal: { kind: "internship", target: "power electronics", visible: false, since: "2026-11-01" },
  record: { projects: 2, signed: 2, waiting: 1, looked: 0 },
  signed_work: [
    { title: "Line follower: course in 41.2 s", project: "Line robot", tags: ["Robotics"] },
    { title: "Balanced all 12 cells within 5 mV", project: "Battery management board", tags: ["Electrical & Power Systems"] },
  ],
  open_work: [
    { id: "m1", title: "Gimbal mount held 1.4 kN", project: "Test stand", status: "waiting for the club" },
    { id: "m2", title: "Buck converter at 94% efficiency (power electronics)", project: "Power supply", status: "waiting for a signature" },
  ],
  url: "/profile",
};

test("the progress line, path and next step are the app's own (goalPath)", () => {
  const s = goalSummary(base);
  assert.ok(s.goal && "progress" in s);
  assert.equal(s.progress, "2 of 3 signed toward a summer internship in power electronics");
  const app = goalPath({ kind: "internship", target: "power electronics" }, base.record);
  assert.equal(s.next, app.next.text);
  assert.deepEqual(s.path.map((p) => p.state), app.steps.map((p) => p.state));
  assert.equal(s.visible_to_companies, false);
});

test("work that fits the goal ranks first, signed and still to sign", () => {
  const s = goalSummary(base);
  assert.ok(s.goal && "strongest" in s && s.strongest && s.to_get_signed);
  assert.match(s.strongest[0].title, /cells/, "the power result leads, ahead of the robot");
  assert.equal(s.to_get_signed[0].id, "m2");
  assert.equal(relevance("", base.signed_work[0]), 0, "no field named: no ranking");
});

test("with no goal, it says so and offers once, without setting anything", () => {
  const s = goalSummary({ ...base, goal: null });
  assert.equal(s.goal, null);
  assert.match(s.next, /Offer once, in one line/);
  assert.ok("kinds" in s && s.kinds.length === 6);
});

test("prompts read the goal, say why each draft matters, and stay honest", () => {
  for (const name of ["start", "shipped", "week", "career_fair"]) {
    const t = promptText(name, { field: "Electronics" }, { canDraft: true, canPost: true })!;
    assert.match(t, /call my_goal/, name);
    assert.match(t, /Toward your goal: …/, name);
    assert.match(t, /No invented market data, no promises of outcomes/, name);
  }
  assert.match(goalLine({ canDraft: true, canPost: true }), /set_goal, after they choose whether companies should see it/);
  assert.doesNotMatch(goalLine({ canDraft: true, canPost: false }), /set_goal/, "a token that can't post isn't told to set it");
});

test("matching ignores simple word endings: a goal in engines finds engine work", () => {
  assert.ok(relevance("liquid rocket engines", { title: "Static fire at 1.2 kN", project: "Liquid engine test stand" }) >= 2);
  assert.equal(relevance("power electronics", { title: "Line follower", project: "Line robot", tags: ["Robotics"] }), 0);
});
