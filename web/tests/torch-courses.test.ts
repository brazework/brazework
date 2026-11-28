// Torch in a course (lib/copilot-tools.ts): it drafts assignments, announcements and extensions for a
// class's staff, as cards the professor confirms. It never writes, and never hands a student a course
// draft. Quizzes and attendance were taken out (2026-11-27: the school's LMS runs them), so Torch
// offers neither.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOLS, makeExec } from "@/lib/copilot-tools";
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

test("Torch has no quiz or attendance tool, and a student asking for a course draft gets no card", async () => {
  const names = TOOLS.map((t) => t.name);
  for (const gone of ["propose_quiz", "propose_attendance"]) assert.ok(!names.includes(gone), `${gone} is still a tool`);
  const cards: Proposal[] = [];
  const r = (await makeExec(classDb("member").db, ME, (p) => cards.push(p))("propose_assignment", { class_id: "c1", title: "Memo" })) as { error?: string };
  assert.match(r.error ?? "", /professor or teaching assistants/);
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
