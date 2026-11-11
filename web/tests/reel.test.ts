// The project reel tells a build's story as a timeline, only from its real material, in date order,
// within limits. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_STEPS, buildReel, positions, type ReelInput } from "@/lib/reel";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const photo = (n: number) => ({ type: "image" as const, path: `u/p${n}.jpg` });
const base: ReelInput = {
  title: "Liquid engine test stand", summary: "A load-cell stand for static fires up to 2 kN.", writeup: "", status: "in_progress", year: null,
  owner: "Ben Cho", club: "Rocketry Club", team: [], tools: [], specs: [], started: "2026-10-01T12:00:00Z", updates: [], proof: [],
};
const kinds = (input: ReelInput) => buildReel(input, NOW).scenes.map((s) => s.kind);

test("a bare project still makes a reel: title, goal, end", () => {
  assert.deepEqual(kinds(base), ["title", "goal", "end"]);
});

test("the journey is in date order, each verified milestone at its own date", () => {
  const r = buildReel({
    ...base, team: ["Maya Patel"], tools: ["SolidWorks"], specs: [{ label: "Peak thrust", value: "2 kN" }],
    // Given out of order on purpose.
    updates: [
      { at: "2026-10-20T12:00:00Z", text: "Static fire #3 done.", media: photo(3) },
      { at: "2026-10-02T12:00:00Z", text: "Frame welded.", media: photo(1) },
      { at: "2026-10-09T12:00:00Z", text: "Load cell calibrated.", media: null },
    ],
    proof: [{ title: "Static fire at 1.2 kN", detail: "Within 3% of simulation", note: "Watched the fire and read the logs.", by: "Maya Patel", club: "Rocketry Club", on: "2026-10-20" }],
  }, NOW);
  assert.deepEqual(r.scenes.map((s) => s.kind), ["title", "goal", "step", "step", "step", "proof", "specs", "tools", "end"]);
  const steps = r.scenes.filter((s) => s.kind === "step");
  assert.deepEqual(steps.map((s) => s.kind === "step" && s.text), ["Frame welded.", "Load cell calibrated.", "Static fire #3 done."]);
  assert.deepEqual(steps.map((s) => s.kind === "step" && s.week), [1, 2, 3], "weeks count from when the project started");
  const title = r.scenes[0]; assert.ok(title.kind === "title" && title.cover?.path === "u/p1.jpg" && title.updates === 3 && title.verified === 1, "the earliest photo is the cover");
  const proof = r.scenes[5]; assert.ok(proof.kind === "proof" && proof.week === 3 && proof.note === "Watched the fire and read the logs.", "the proof sits after the update of the same day, with what was checked");
  assert.ok(r.live && r.end === NOW, "an open build runs to today");
});

test("the timeline: the intro at the start, events by date, the wrap-up at the end", () => {
  const r = buildReel({ ...base, updates: [{ at: "2026-10-01T12:00:00Z", text: "Start", media: null }, { at: "2026-11-11T12:00:00Z", text: "Today", media: null }] }, NOW);
  const pos = positions(r);
  assert.deepEqual(r.scenes.map((s) => s.kind), ["title", "goal", "step", "step", "end"]);
  assert.deepEqual(pos, [0, 0, 0, 1, 1]);
  const finished = buildReel({ ...base, status: "completed", updates: [{ at: "2026-10-01T12:00:00Z", text: "a", media: null }, { at: "2026-10-11T12:00:00Z", text: "b", media: null }] }, NOW);
  assert.equal(finished.end, Date.parse("2026-10-11T12:00:00Z"), "a finished build ends at its last moment, not today");
});

test("many updates are thinned evenly, keeping the first and last; verified milestones are never dropped", () => {
  const updates = Array.from({ length: 20 }, (_, i) => ({ at: new Date(Date.parse("2026-10-01T12:00:00Z") + i * 864e5).toISOString(), text: `Day ${i}`, media: null }));
  const proof = Array.from({ length: 5 }, (_, i) => ({ title: `M${i}`, detail: "", note: "", by: "Maya", club: "Rocketry Club", on: `2026-10-0${i + 2}` }));
  const r = buildReel({ ...base, updates, proof }, NOW);
  const steps = r.scenes.filter((s) => s.kind === "step");
  assert.equal(steps.length, MAX_STEPS);
  assert.ok(steps[0].kind === "step" && steps[0].text === "Day 0" && steps.at(-1)?.kind === "step" && steps.at(-1)!.kind === "step");
  assert.ok(steps.at(-1)!.kind === "step" && (steps.at(-1) as { text: string }).text === "Day 19");
  assert.equal(r.scenes.filter((s) => s.kind === "proof").length, 5);
  const end = r.scenes.at(-1)!; assert.ok(end.kind === "end" && end.updates === 20 && end.verified === 5, "the totals count everything");
});

test("long text is cut at a sentence, not mid-word", () => {
  const long = "First sentence about the build. " + "More detail ".repeat(40);
  const goal = buildReel({ ...base, summary: long }, NOW).scenes[1];
  assert.ok(goal.kind === "goal" && goal.text === "First sentence about the build.");
});
