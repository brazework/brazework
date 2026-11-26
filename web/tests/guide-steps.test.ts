// The first steps on Today (lib/guide-steps.ts): a student is sent to their club first, because the
// club signs their work; someone working with no club is sent to the work, then to a person who saw
// it. Nobody is told to join a club they may never have. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clubPath, describeMember, loopSteps, type LoopFacts } from "@/lib/guide-steps";

const fresh: LoopFacts = { student: true, inClub: false, hasProject: false, hasUpdate: false, asked: false, verified: false, milestones: true };
const ids = (f: Partial<LoopFacts>) => loopSteps({ ...fresh, ...f }).map((s) => s.id);
const next = (f: Partial<LoopFacts>) => loopSteps({ ...fresh, ...f }).find((s) => !s.done)?.label;

test("a student starts with their club, as before", () => {
  assert.deepEqual(ids({}), ["club", "project", "update", "ask-verify", "verified"]);
  assert.equal(next({}), "Join your club");
  assert.equal(next({ inClub: true }), "Add what you're building");
  assert.equal(next({ inClub: true, hasProject: true, hasUpdate: true }), "Ask your club to verify a milestone");
});

test("someone working with no club starts with the work and asks a person", () => {
  const pro = { student: false };
  assert.deepEqual(ids(pro), ["project", "update", "ask-verify", "verified"]);
  assert.equal(next(pro), "Add what you're building");
  assert.equal(next({ ...pro, hasProject: true, hasUpdate: true }), "Ask someone who saw it to verify a milestone");
  for (const s of loopSteps({ ...fresh, ...pro })) assert.ok(!/club/i.test(s.label + s.why), s.id);
});

test("a professional who joined a club gets the club's steps, with the club step done", () => {
  const steps = loopSteps({ ...fresh, student: false, inClub: true });
  assert.deepEqual(steps.map((s) => s.id), ["club", "project", "update", "ask-verify", "verified"]);
  assert.equal(steps[0].done, true);
  assert.equal(clubPath({ student: false, inClub: true }), true);
  assert.equal(clubPath({ student: false, inClub: false }), false);
});

test("without milestones in the database, the steps stop at the update", () => {
  assert.deepEqual(ids({ milestones: false }), ["club", "project", "update"]);
  assert.deepEqual(ids({ student: false, milestones: false }), ["project", "update"]);
});

test("everything done leaves nothing next", () => {
  assert.equal(next({ student: false, hasProject: true, hasUpdate: true, asked: true, verified: true }), undefined);
});

test("Jig is told who it's drafting for", () => {
  assert.equal(describeMember("Physics", true), "a Physics student");
  assert.equal(describeMember("Design & Arts", false), "a Design & Arts professional");
  assert.equal(describeMember("", false), "a professional");
  assert.equal(describeMember(null, true), "a student");
});
