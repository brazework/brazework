// The goal path (lib/goals.ts): built from the real record, and the next step is always the one
// thing that moves it forward. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { goalPath, goalTitle, isGoalKind, nextStep, signupGoalFrom, signupGoals } from "../src/lib/goals";

const g = { kind: "internship" as const, target: "power electronics" };

test("the title reads naturally, with or without a target", () => {
  assert.equal(goalTitle(g), "a summer internship in power electronics");
  assert.equal(goalTitle({ kind: "grad", target: "" }), "grad school");
});

test("nothing yet: the next step is a project", () => {
  const p = goalPath(g, { projects: 0, signed: 0, waiting: 0, looked: 0 });
  assert.deepEqual(p.steps.map((s) => s.state), ["now", "next", "next"]);
  assert.equal(p.done, 0);
  assert.equal(p.next.action, "Add a project");
});

test("building: waiting milestones come before new ones", () => {
  assert.equal(nextStep(g, { projects: 1, signed: 1, waiting: 2, looked: 0 }).action, "See what's waiting");
  const n = nextStep(g, { projects: 1, signed: 1, waiting: 0, looked: 0 });
  assert.equal(n.action, "Add a milestone");
  assert.match(n.text, /2 more to go/);
});

test("proven: share it, then keep going once people look", () => {
  const p = goalPath(g, { projects: 2, signed: 3, waiting: 0, looked: 0 });
  assert.deepEqual(p.steps.map((s) => s.state), ["done", "done", "now"]);
  assert.equal(p.next.action, "Copy your link");
  const q = goalPath(g, { projects: 2, signed: 5, waiting: 0, looked: 4 });
  assert.equal(q.done, 3);
  assert.match(q.steps[1].detail, /3 of 3/, "signed is capped at the target");
  assert.equal(q.next.action, "Open Requests");
});

test("each goal has its own bar and signers", () => {
  assert.match(goalPath({ kind: "grad", target: "" }, { projects: 1, signed: 0, waiting: 0, looked: 0 }).steps[1].detail, /0 of 2 milestones signed by a professor or PI/);
  assert.equal(isGoalKind("research"), true);
  assert.equal(isGoalKind("fame"), false);
});

// Sign-up's "Where are you headed?" (app/onboarding/finish-signup-form.tsx).
test("sign-up offers goals that fit a student or someone who works, most likely first", () => {
  assert.equal(signupGoals("student")[0].kind, "internship");
  assert.equal(signupGoals("professional")[0].kind, "job");
  assert.ok(!signupGoals("professional").some((g) => g.kind === "internship"));
  for (const t of ["student", "professional"] as const) for (const g of signupGoals(t)) { assert.ok(isGoalKind(g.kind)); assert.ok(g.example && g.label); }
});

test("sign-up's goal is read safely: nothing picked, a kind that doesn't fit, or a bad target never blocks", () => {
  assert.equal(signupGoalFrom("", "x", "student"), null);
  assert.equal(signupGoalFrom("hacker", "x", "student"), null);
  assert.equal(signupGoalFrom("internship", "x", "professional"), null);
  assert.deepEqual(signupGoalFrom("internship", "  power   electronics ", "student"), { kind: "internship", target: "power electronics" });
  assert.deepEqual(signupGoalFrom("funding", null, "professional"), { kind: "funding", target: "" });
  assert.deepEqual(signupGoalFrom("job", "<script>", "professional"), { kind: "job", target: "" });
  assert.deepEqual(signupGoalFrom("grad", "x".repeat(81), "student"), { kind: "grad", target: "" });
});

// Torch does the next step (26 Nov): each ask is about this goal and where the member is on the path,
// and asks for cards to approve rather than doing anything by itself.
import { torchGoalFrom, torchNext, torchWeek } from "../src/lib/goals";

test("Torch's next step follows the path: project, then waiting, then the next milestone, then who to send it to", () => {
  const at = (r: { projects: number; signed: number; waiting: number; looked: number }) => torchNext(g, r);
  assert.equal(at({ projects: 0, signed: 0, waiting: 0, looked: 0 }).label, "Add it with Torch");
  assert.equal(at({ projects: 1, signed: 0, waiting: 2, looked: 0 }).label, "Nudge them with Torch");
  assert.match(at({ projects: 1, signed: 0, waiting: 2, looked: 0 }).prompt, /2 of my milestones are still waiting/);
  assert.equal(at({ projects: 1, signed: 1, waiting: 0, looked: 0 }).label, "Find my next milestone");
  assert.match(at({ projects: 1, signed: 1, waiting: 0, looked: 0 }).prompt, /your club or a mentor/);
  assert.equal(at({ projects: 2, signed: 3, waiting: 0, looked: 0 }).label, "Find who to send it to");
  assert.match(at({ projects: 2, signed: 3, waiting: 0, looked: 0 }).prompt, /companies hiring interns in power electronics/);
  assert.equal(at({ projects: 2, signed: 3, waiting: 0, looked: 4 }).label, "What should I do next?");
});

test("every Torch ask names the goal and asks for something to approve, never to act on its own", () => {
  const all = [0, 1].flatMap((p) => [0, 2].flatMap((w) => [0, 3].map((s) => torchNext(g, { projects: p, signed: s, waiting: w, looked: 0 })))).concat(torchWeek(g));
  for (const a of all) {
    assert.match(a.prompt, /a summer internship in power electronics/);
    assert.match(a.prompt, /draft|Draft|Prepare|approve/);
  }
});

test("a goal in your own words: trimmed, capped, and nothing to send when it's empty", () => {
  assert.equal(torchGoalFrom("  "), null);
  assert.equal(torchGoalFrom("ok"), null);
  const a = torchGoalFrom("  a summer   internship at a robotics startup ");
  assert.match(a!.prompt, /"a summer internship at a robotics startup"/);
  assert.match(a!.prompt, /goal card for me to approve/);
  assert.equal(torchGoalFrom("x".repeat(500))!.prompt.match(/"(x+)"/)![1].length, 200);
});
test("the setup orders the goals for who you are, and every goal says what it means", async () => {
  const { goalChoices, GOAL_HELP, GOAL_KINDS } = await import("../src/lib/goals");
  const student = goalChoices("student"), pro = goalChoices("professional");
  assert.equal(student[0].kind, "internship");
  assert.equal(student.find((c) => c.kind === "job")?.label, "First job");
  assert.deepEqual(pro.slice(0, 2).map((c) => c.kind), ["job", "funding"]);
  assert.equal(pro[0].label, "Next role");
  for (const list of [student, pro, goalChoices(null)]) assert.deepEqual([...list.map((c) => c.kind)].sort(), Object.keys(GOAL_KINDS).sort());
  for (const k of Object.keys(GOAL_KINDS) as (keyof typeof GOAL_KINDS)[]) {
    assert.ok(GOAL_HELP[k].line.length > 0 && GOAL_HELP[k].examples.length >= 3);
    for (const ex of GOAL_HELP[k].examples) assert.ok(ex.length <= 80 && !/[<>]/.test(ex));
  }
});
