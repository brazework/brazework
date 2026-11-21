// What Ember knows about a record and the steps a new chat opens with (lib/ember-record.ts,
// Linear FIX-216). The steps come from the record, never the model, so they can be pinned here.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_RECORD, SLOW_DAYS, nextSteps, recordLines, type EmberRecord, type OpenMilestone } from "@/lib/ember-record";

const P = [{ id: "p1", title: "Clinic check-in kiosk" }];
const open = (o: Partial<OpenMilestone> = {}): OpenMilestone => ({ id: "m1", title: "Check-in time from 48 s to 19 s", project_id: "p1", club: false, asked: [], on: "2026-11-03", ...o });
const rec = (r: Partial<EmberRecord>): EmberRecord => ({ ...EMPTY_RECORD, projects: P, ...r });
const ids = (r: EmberRecord) => nextSteps(r).map((s) => s.id);

test("no project: one step, and it starts the sentence", () => {
  const steps = nextSteps(EMPTY_RECORD);
  assert.deepEqual(steps.map((s) => s.id), ["first-project"]);
  assert.ok("finish" in steps[0] && steps[0].finish, "it waits for the member to say what they built");
  assert.match(recordLines(EMPTY_RECORD).join(" "), /no project yet/);
});

test("a project with nothing on it: log your first result", () => {
  assert.deepEqual(ids(rec({})), ["first-result"]);
  const s = nextSteps(rec({}))[0];
  assert.ok("text" in s && s.text === "Today I ", "the same sentence the Log what I did button starts");
});

test("a milestone nobody was asked about: ask someone, by its name", () => {
  const one = nextSteps(rec({ open: [open()] }));
  assert.deepEqual(one.map((s) => s.id), ["unsigned"]);
  assert.equal(one[0].label, '"Check-in time from 48 s to 19 s" has no signature yet');
  assert.ok("text" in one[0] && one[0].text.includes('"Check-in time from 48 s to 19 s"'));
  const two = nextSteps(rec({ open: [open(), open({ id: "m2", title: "Second" })] }));
  assert.equal(two[0].label, "2 milestones have no signature yet");
});

test("with a club, or with an ask out, there is nothing to nag about yet", () => {
  assert.deepEqual(ids(rec({ open: [open({ club: true })] })), []);
  assert.deepEqual(ids(rec({ open: [open({ asked: [{ email: "sam@northwind.example", days: SLOW_DAYS - 1 }] })] })), []);
});

test("an ask that has sat for days comes first, slowest first", () => {
  const steps = nextSteps(rec({ open: [
    open({ id: "m1", asked: [{ email: "sam@northwind.example", days: SLOW_DAYS }] }),
    open({ id: "m2", title: "Second", asked: [{ email: "dana@northwind.example", days: 12 }] }),
    open({ id: "m3", title: "Third" }),
  ] }));
  assert.deepEqual(steps.map((s) => s.id), ["slow", "unsigned"]);
  assert.equal(steps[0].label, "dana@northwind.example hasn't answered in 12 days");
  assert.ok("text" in steps[0] && /ask someone else/.test(steps[0].text));
});

test("merged pull requests not on the record open the project page, not a chat", () => {
  const steps = nextSteps(rec({ proven: 2, unlogged: { project_id: "p1", count: 3 } }));
  assert.deepEqual(steps.map((s) => s.id), ["unlogged"]);
  assert.ok("href" in steps[0] && steps[0].href === "/projects/p1");
  assert.equal(steps[0].label, "3 merged pull requests aren't on your record");
  assert.equal(nextSteps(rec({ proven: 2, unlogged: { project_id: "p1", count: 1 } }))[0].label, "1 merged pull request isn't on your record");
});

test("a record in order offers nothing, and there are never more than three", () => {
  assert.deepEqual(ids(rec({ proven: 4 })), []);
  const busy = rec({ unlogged: { project_id: "p1", count: 2 }, open: [open({ asked: [{ email: "a@b.example", days: 9 }] }), open({ id: "m2", title: "Second" })] });
  assert.deepEqual(ids(busy), ["slow", "unsigned", "unlogged"]);
  assert.ok(nextSteps(busy).length <= 3);
});

test("Ember is told what is waiting, on whom, and the id to act on", () => {
  const text = recordLines(rec({ proven: 3, repos: ["acme/kiosk"], needsLinkedin: true, unlogged: { project_id: "p1", count: 2 }, open: [
    open({ asked: [{ email: "sam@northwind.example", days: 6 }] }), open({ id: "m2", title: "Second", club: true }), open({ id: "m3", title: "Third" }),
  ] })).join("\n");
  assert.match(text, /signed, verified or backed so far: 3/);
  assert.match(text, /"Check-in time from 48 s to 19 s" \(2026-11-03; milestone id m1; asked sam@northwind\.example 6 days ago, no answer yet\)/);
  assert.match(text, /"Second" \(2026-11-03; milestone id m2; with a club's officers\)/);
  assert.match(text, /"Third" \(2026-11-03; milestone id m3; nobody asked yet\)/);
  assert.match(text, /propose_signature/);
  assert.match(text, /acme\/kiosk/);
  assert.match(text, /2 of their own merged pull requests/);
  assert.match(text, /don't ask for it yourself/);
  assert.deepEqual(recordLines(rec({})), [], "nothing to say about an empty project");
});

test("a long list is cut, and says how many more", () => {
  const many = Array.from({ length: 9 }, (_, i) => open({ id: `m${i}`, title: `Result ${i}` }));
  assert.match(recordLines(rec({ open: many })).join("\n"), /and 3 more/);
});

// Ember as a career guide: the goal leads the steps and what Ember is told (lib/goals.ts).
test("a goal leads the steps: where they're going and how far along", () => {
  const r = rec({ goal: { kind: "internship", target: "power electronics" }, proven: 1, open: [open()] });
  const steps = nextSteps(r);
  assert.equal(steps[0].id, "goal");
  assert.equal(steps[0].label, "Toward a summer internship in power electronics: 1 of 3 signed");
  assert.ok("text" in steps[0] && /goal/.test(steps[0].text));
  // The path's own next step, from the record: one is waiting.
  assert.match(steps[0].hint, /1 milestone is waiting to be signed/);
  assert.ok(steps.length <= 3);
  const said = recordLines(r).join(" ");
  assert.match(said, /Their goal: a summer internship in power electronics\. On the path: 1 of 3 milestones signed/);
  assert.match(said, /Tie your suggestions to this goal/);
});

test("enough signed: the goal step says they're ready", () => {
  assert.equal(nextSteps(rec({ goal: { kind: "grad", target: "" }, proven: 2 }))[0].label, "Ready for grad school");
});

test("no goal set: the first step offers to choose one, worded for a student or someone working", () => {
  const student = nextSteps(rec({ goal: null, student: true }));
  assert.equal(student[0].id, "set-goal");
  assert.ok("finish" in student[0] && student[0].finish, "it waits for them to say where they want to be");
  assert.match(student[0].hint, /internship/);
  assert.match(nextSteps(rec({ goal: null, student: false }))[0].hint, /next role/);
  assert.match(recordLines(rec({ goal: null })).join(" "), /haven't set a goal yet.*propose_goal/);
});

test("not known whether there's a goal: nothing is offered or assumed", () => {
  const r = rec({ goal: undefined });
  assert.ok(!nextSteps(r).some((s) => s.id === "goal" || s.id === "set-goal"));
  assert.doesNotMatch(recordLines(r).join(" "), /goal/i);
});

test("no project yet: adding one still comes first, goal or not", () => {
  assert.deepEqual(nextSteps({ ...EMPTY_RECORD, goal: { kind: "job", target: "" } }).map((s) => s.id), ["first-project"]);
});
