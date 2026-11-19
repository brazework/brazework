// The project page's Next strip (lib/next-step.ts): one step, in the spec's order. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStep, statusLine } from "@/lib/next-step";

const v = (id: string) => ({ id, title: `Signed ${id}`, status: "verified", community_id: "rkt", community_name: "Rocketry Club" });
const p = (id: string, club = true) => ({ id, title: `Waiting ${id}`, status: "pending", community_id: club ? "rkt" : null, community_name: club ? "Rocketry Club" : null });

test("visitors get no Next strip", () => {
  assert.equal(nextStep({ builder: false, milestones: [p("m1")], drafts: [] }), null);
});

test("a waiting milestone comes first: ask the people who can sign it, by name", () => {
  const s = nextStep({ builder: true, milestones: [v("m0"), p("m1")], drafts: [{ id: "d1", title: "x" }], signers: new Map([["rkt", ["Ben C."]]]) });
  assert.deepEqual(s, { kind: "ask_sign", milestoneId: "m1", title: "Waiting m1", who: "Rocketry Club", signers: ["Ben C."] });
  const vouch = nextStep({ builder: true, milestones: [p("m2", false)], drafts: [] });
  assert.equal(vouch?.kind === "ask_sign" && vouch.who, "the person you asked");
});

test("no milestone yet (declined ones don't count): log the first, even with a draft waiting", () => {
  assert.deepEqual(nextStep({ builder: true, milestones: [], drafts: [] }), { kind: "first_milestone" });
  assert.deepEqual(nextStep({ builder: true, milestones: [{ ...v("m1"), status: "declined" }], drafts: [{ id: "d1", title: "x" }] }), { kind: "first_milestone" });
});

test("then a draft to send, then the signed card to share", () => {
  assert.deepEqual(nextStep({ builder: true, milestones: [v("m1")], drafts: [{ id: "d1", title: "Thrust curve" }] }), { kind: "send_draft", draftId: "d1", title: "Thrust curve" });
  assert.deepEqual(nextStep({ builder: true, milestones: [v("m1")], drafts: [] }), { kind: "share_signed", milestoneId: "m1", title: "Signed m1" });
  assert.equal(nextStep({ builder: true, milestones: [{ ...v("m1"), status: "logged" }], drafts: [] }), null, "logged, nothing to sign or share: no strip");
});

test("the status line under the title", () => {
  assert.equal(statusLine([v("a"), v("b"), v("c"), p("d")]), "3 signed · 1 waiting");
  assert.equal(statusLine([p("d")]), "1 waiting");
  assert.equal(statusLine([v("a")]), "1 signed");
  assert.equal(statusLine([{ status: "declined" }]), "");
});

test("with a goal, the goal's next step picks the move, worded toward it", () => {
  const goal = { kind: "internship" as const, target: "power electronics" };
  const toward = "a summer internship in power electronics";
  // Something's waiting anywhere on the record: nudge the signer, here on this project.
  assert.deepEqual(nextStep({ builder: true, milestones: [p("m1")], drafts: [], goal, record: { projects: 2, signed: 1, waiting: 1, looked: 0 } }),
    { kind: "ask_sign", milestoneId: "m1", title: "Waiting m1", who: "Rocketry Club", signers: [], toward });
  // Fewer signed than the goal needs, nothing waiting: log the next one on this project.
  assert.deepEqual(nextStep({ builder: true, milestones: [v("m1")], drafts: [{ id: "d1", title: "x" }], goal, record: { projects: 1, signed: 1, waiting: 0, looked: 0 } }), { kind: "log_milestone", toward });
  assert.deepEqual(nextStep({ builder: true, milestones: [], drafts: [], goal, record: { projects: 2, signed: 0, waiting: 0, looked: 0 } }), { kind: "first_milestone", toward });
  // Enough signed and nobody has looked: share this project's signed card.
  assert.deepEqual(nextStep({ builder: true, milestones: [v("m1")], drafts: [], goal, record: { projects: 1, signed: 3, waiting: 0, looked: 0 } }), { kind: "share_signed", milestoneId: "m1", title: "Signed m1", toward });
  // Waiting elsewhere, not here: this project's own step, still toward the goal.
  assert.deepEqual(nextStep({ builder: true, milestones: [v("m1")], drafts: [], goal, record: { projects: 2, signed: 1, waiting: 1, looked: 0 } }), { kind: "share_signed", milestoneId: "m1", title: "Signed m1", toward });
  assert.equal(nextStep({ builder: false, milestones: [p("m1")], drafts: [], goal, record: { projects: 1, signed: 0, waiting: 1, looked: 0 } }), null, "visitors never see it");
});

test("without a goal, the strip has no 'toward'", () => {
  const s = nextStep({ builder: true, milestones: [], drafts: [], goal: null, record: null });
  assert.deepEqual(s, { kind: "first_milestone" });
});
