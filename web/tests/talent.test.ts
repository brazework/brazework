// Find builders: only verified work counts, every search word must match, and ranking is by
// verified work, then recency. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBuilders, classYears, rankBuilders, type Person, type VerifiedRow } from "@/lib/talent";

const people: Person[] = [
  { id: "a", first_name: "Ana", last_name: "Ruiz", headline: "Avionics", field: "Aerospace", open_to: ["internships"] },
  { id: "b", first_name: "Ben", last_name: "Cho", headline: "Propulsion lead", field: "Mechanical", open_to: [] },
  { id: "c", first_name: "Cy", last_name: "Lee", headline: "", field: "", open_to: null },
];
const row = (id: string, owner: string, title: string, at: string, tools: string[], club = "rkt"): VerifiedRow => ({
  id, owner_id: owner, community_id: club, community_name: club === "rkt" ? "Rocketry Club" : "Robotics Society", title,
  reviewer_name: "Maya Patel", reviewer_role: "admin", reviewed_at: at, projects: { title: `${title} project`, tags: [], tools },
});
const rows = [
  row("1", "a", "Flight computer logs at 200 Hz", "2026-11-01T00:00:00Z", ["STM32", "C"]),
  row("2", "b", "Static fire at 1.2 kN", "2026-10-01T00:00:00Z", ["LabVIEW"]),
  row("3", "b", "Vibration test passed", "2026-09-01T00:00:00Z", ["STM32"], "rob"),
];

test("people without verified work never appear", () => {
  const list = buildBuilders(rows, people);
  assert.deepEqual(list.map((b) => b.person.id).sort(), ["a", "b"]);
});

test("more verified work ranks first, then the most recent", () => {
  assert.deepEqual(rankBuilders(buildBuilders(rows, people), {}).map((b) => b.person.id), ["b", "a"]);
  const tie = [row("1", "a", "x", "2026-11-01T00:00:00Z", []), row("2", "b", "y", "2026-10-01T00:00:00Z", [])];
  assert.deepEqual(rankBuilders(buildBuilders(tie, people), {}).map((b) => b.person.id), ["a", "b"]);
});

test("every search word must match the person's verified work or public profile", () => {
  const list = buildBuilders(rows, people);
  assert.deepEqual(rankBuilders(list, { q: "stm32" }).map((b) => b.person.id), ["b", "a"]);
  assert.deepEqual(rankBuilders(list, { q: "stm32 labview" }).map((b) => b.person.id), ["b"]);
  assert.deepEqual(rankBuilders(list, { q: "quantum" }), []);
});

test("filters: club, open to, minimum verified", () => {
  const list = buildBuilders(rows, people);
  assert.deepEqual(rankBuilders(list, { club: "rob" }).map((b) => b.person.id), ["b"]);
  assert.deepEqual(rankBuilders(list, { openTo: "internships" }).map((b) => b.person.id), ["a"]);
  assert.deepEqual(rankBuilders(list, { min: 2 }).map((b) => b.person.id), ["b"]);
});

test("class year: filters to that year, and the chips offer only years someone has", () => {
  const withYears: Person[] = [{ ...people[0], grad_year: 2027 }, { ...people[1], grad_year: 2026 }, people[2]];
  const list = buildBuilders(rows, withYears);
  assert.deepEqual(rankBuilders(list, { year: 2027 }).map((b) => b.person.id), ["a"]);
  assert.deepEqual(rankBuilders(list, { year: 2030 }), []);
  assert.deepEqual(classYears(list), [2026, 2027]);
  // Nobody has set one yet: no chips at all.
  assert.deepEqual(classYears(buildBuilders(rows, people)), []);
});

// Backed by GitHub (FIX-121): counted apart from signed work, never as verified, and ranked after it.
const backedRow = (id: string, owner: string, title: string): VerifiedRow => ({
  id, owner_id: owner, community_id: null, community_name: "", title, reviewer_name: "", reviewed_at: null, backed: true,
  backing: { kind: "pull_request", repo_full_name: "cy/solver", ref: "12" }, projects: { title: `${title} project`, tags: [], tools: ["Rust"] },
});

test("backed work counts on its own, never as verified, and adds no club", () => {
  const list = buildBuilders([...rows, backedRow("9", "c", "Sparse solver merged"), backedRow("8", "a", "Telemetry parser merged")], people);
  const cy = list.find((b) => b.person.id === "c")!, ana = list.find((b) => b.person.id === "a")!;
  assert.equal(cy.verified, 0); assert.equal(cy.backed, 1); assert.deepEqual(cy.clubs, []);
  assert.equal(ana.verified, 1); assert.equal(ana.backed, 1);
});

test("signed work ranks above backed work; the minimum counts both only when backed work is shown", () => {
  const list = buildBuilders([row("1", "a", "x", "2026-11-01T00:00:00Z", []), backedRow("9", "c", "a"), backedRow("8", "c", "b"), backedRow("7", "c", "c")], people);
  assert.deepEqual(rankBuilders(list, { backed: true }).map((b) => b.person.id), ["a", "c"]);
  assert.deepEqual(rankBuilders(list, {}).map((b) => b.person.id), ["a"], "signed only: people with only backed work don't appear");
  assert.deepEqual(rankBuilders(list, { backed: true, min: 3 }).map((b) => b.person.id), ["c"]);
  assert.ok(rankBuilders(list, { backed: true, q: "rust" }).some((b) => b.person.id === "c"), "backed work is searchable");
});
