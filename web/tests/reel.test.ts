// The project reel tells a build's story only from its real material, in a fixed order, within
// limits. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReel, type ReelInput } from "@/lib/reel";

const photo = (n: number) => ({ item: { type: "image" as const, path: `u/p${n}.jpg` }, caption: `Photo ${n}` });
const base: ReelInput = {
  title: "Liquid engine test stand", summary: "A load-cell stand for static fires up to 2 kN.", writeup: "", status: "in_progress", year: null,
  owner: "Ben Cho", club: "Rocketry Club", team: [], tools: [], specs: [], media: [], proof: [],
};

test("a bare project still makes a reel: title, goal, end", () => {
  assert.deepEqual(buildReel(base).map((s) => s.kind), ["title", "goal", "end"]);
});

test("the full story, in order", () => {
  const r = buildReel({
    ...base, team: ["Maya Patel"], tools: ["SolidWorks", "LabVIEW"], specs: [{ label: "Peak thrust", value: "2 kN" }],
    media: [photo(1), photo(2)],
    proof: [{ title: "Static fire at 1.2 kN", detail: "Within 3% of simulation", by: "Maya Patel", club: "Rocketry Club", on: "2026-11-01" }],
  });
  assert.deepEqual(r.map((s) => s.kind), ["title", "goal", "media", "specs", "proof", "tools", "end"]);
  const title = r[0]; assert.ok(title.kind === "title" && title.cover?.path === "u/p1.jpg", "the first photo is the cover");
  const end = r[r.length - 1]; assert.ok(end.kind === "end" && end.team.join(",") === "Ben Cho,Maya Patel" && end.verified === 1);
});

test("limits: four photos, three proofs, four specs, eight tools", () => {
  const r = buildReel({
    ...base, media: [1, 2, 3, 4, 5, 6, 7].map(photo),
    specs: Array.from({ length: 6 }, (_, i) => ({ label: `S${i}`, value: String(i) })),
    tools: Array.from({ length: 12 }, (_, i) => `T${i}`),
    proof: Array.from({ length: 5 }, (_, i) => ({ title: `M${i}`, detail: "", by: "Maya", club: "Rocketry Club", on: "2026-11-01" })),
  });
  assert.equal(r.filter((s) => s.kind === "media").length, 4);
  const proofs = r.filter((s) => s.kind === "proof"); assert.equal(proofs.length, 3);
  assert.ok(proofs[2].kind === "proof" && proofs[2].n === 3 && proofs[2].of === 3);
  const specs = r.find((s) => s.kind === "specs"); assert.ok(specs?.kind === "specs" && specs.specs.length === 4);
  const tools = r.find((s) => s.kind === "tools"); assert.ok(tools?.kind === "tools" && tools.tools.length === 8);
  const end = r[r.length - 1]; assert.ok(end.kind === "end" && end.verified === 5, "the end card counts all of them");
});

test("long text is cut at a sentence, not mid-word", () => {
  const long = "First sentence about the build. " + "More detail ".repeat(40);
  const goal = buildReel({ ...base, summary: long })[1];
  assert.ok(goal.kind === "goal" && goal.text === "First sentence about the build.");
});
