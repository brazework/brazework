// Torch in a course (lib/copilot-tools.ts): it writes quizzes and drafts assignments, announcements,
// extensions and attendance for a class's staff, as cards the professor confirms. It never writes,
// never hands a student a quiz to draft, and never lets a quiz through without a right answer.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeExec } from "@/lib/copilot-tools";
import type { Proposal } from "@/lib/copilot-agent";

const ME = "00000000-0000-0000-0000-000000000001";

// Reads return a class and the member's role in it; any write throws.
function classDb(role: string) {
  const writes: string[] = [];
  const fixture = (table: string) => (table === "communities" ? { name: "ME 410 · Capstone Design", type: "class" } : table === "community_members" ? { role } : {});
  const builder = (table: string): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "order", "limit"]) b[m] = () => b;
    for (const m of ["insert", "update", "delete", "upsert"]) b[m] = () => { writes.push(`${m} ${table}`); throw new Error("WRITE ATTEMPT"); };
    b.maybeSingle = async () => ({ data: fixture(table), error: null });
    return b;
  };
  return { db: { from: (t: string) => builder(t), rpc: (n: string) => { writes.push(`rpc ${n}`); throw new Error("WRITE ATTEMPT"); } } as never, writes };
}

const QUIZ = {
  class_id: "c1", title: "Quiz 1: Gear trains", closes_at: "2026-12-01T17:00:00-05:00",
  questions: [
    { prompt: "A 20-tooth gear drives a 60-tooth gear. Speed ratio?", type: "choice", options: ["1:3", "3:1"], answer: 1, points: 2 },
    { prompt: "Which change with a gear ratio?", type: "multi", options: ["Torque", "Speed", "Ideal power"], answer: [0, 1, 1], points: 3 },
    { prompt: "Output torque from 4 N·m through 5:1 at 90%?", type: "number", answer: 18, tolerance: 0.2, points: 3 },
    { prompt: "Why a planetary stage here?", type: "short", points: 4 },
  ],
};

test("a professor gets a quiz card with its answers, as a draft, and nothing is written", async () => {
  const { db, writes } = classDb("owner");
  const cards: Proposal[] = [];
  await makeExec(db, ME, (p) => cards.push(p))("propose_quiz", QUIZ);
  assert.deepEqual(writes, []);
  assert.equal(cards.length, 1);
  const q = cards[0] as Extract<Proposal, { kind: "quiz" }>;
  assert.equal(q.kind, "quiz");
  assert.equal(q.publish, false, "a draft unless the professor says to post");
  assert.deepEqual(q.questions.map((x) => x.id), ["q1", "q2", "q3", "q4"]);
  assert.deepEqual(q.questions[1].answer, [0, 1], "repeated right answers are folded");
  assert.equal(q.questions[2].tolerance, 0.2);
  assert.equal(q.closes_at, new Date("2026-12-01T22:00:00Z").toISOString());
});

test("a quiz question with no right answer, or a student asking, gets no card", async () => {
  const cards: Proposal[] = [];
  const bad = { ...QUIZ, questions: [{ prompt: "Units of force?", type: "choice", options: ["J", "N"], points: 1 }] };
  const r1 = (await makeExec(classDb("owner").db, ME, (p) => cards.push(p))("propose_quiz", bad)) as { error?: string };
  assert.match(r1.error ?? "", /index of the right one/);
  const r2 = (await makeExec(classDb("member").db, ME, (p) => cards.push(p))("propose_quiz", QUIZ)) as { error?: string };
  assert.match(r2.error ?? "", /professor or teaching assistants/);
  assert.equal(cards.length, 0);
});

test("an assignment's rubric sets its points, and outcomes outside ABET's seven are dropped", async () => {
  const cards: Proposal[] = [];
  await makeExec(classDb("moderator").db, ME, (p) => cards.push(p))("propose_assignment", {
    class_id: "c1", title: "Design review", points: 500, group_work: true, peer_eval: true,
    rubric: [{ criterion: "Analysis", points: 40, outcome: "1" }, { criterion: "Teamwork", points: 20, outcome: "9" }],
  });
  const a = cards[0] as Extract<Proposal, { kind: "assignment" }>;
  assert.equal(a.points, 60);
  assert.equal(a.rubric[0].outcome, "1");
  assert.equal(a.rubric[1].outcome, undefined);
  assert.equal(a.peer_eval, true);
  assert.deepEqual(a.submit_as, ["file", "link"]);
});
