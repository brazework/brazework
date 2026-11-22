// The guided tour (FIX-236): every step points at something the app really renders, and the welcome
// tour talks about the five places by their current names. Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PLACES } from "@/lib/places";
import { UPDATES, WELCOME_TARGETS, placeCard, welcomeSteps, whatsNewSteps, type TourBox } from "@/lib/tours";

// Every tour anchor in the source: data-tour="x", a tour="x" prop, or a tour: "x" field (lib/places.ts).
function anchors() {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) {
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(/data-tour="([\w-]+)"|\btour="([\w-]+)"|\btour: "([\w-]+)"/g)) found.add(m[1] ?? m[2] ?? m[3]);
        // data-tour={a ? "x" : undefined}: every name in the expression counts.
        for (const m of src.matchAll(/data-tour=\{([^}]*)\}/g)) for (const q of m[1].matchAll(/"([\w-]+)"/g)) found.add(q[1]);
      }
    }
  };
  walk(join(__dirname, "..", "src"));
  return found;
}

test("every welcome step points at an anchor the app renders", () => {
  const have = anchors();
  const steps = welcomeSteps("Ada");
  const targets = steps.flatMap((s) => (s.target ? [s.target] : []));
  assert.deepEqual(targets, [...WELCOME_TARGETS]);
  for (const t of targets) assert.ok(have.has(t), `no element carries data-tour="${t}"`);
});

test("welcome steps go to real places, open and close without a target", () => {
  const steps = welcomeSteps("Ada");
  assert.equal(steps[0].target, undefined);
  assert.equal(steps.at(-1)?.target, undefined);
  assert.match(steps[0].title, /Ada/);
  const routes = new Set([...PLACES.map((p) => p.href), "/u/", "/settings/tools"]);
  for (const s of steps) assert.ok(!s.route || routes.has(s.route), `unknown route ${s.route}`);
});

test("the places step uses today's names, not the old ones", () => {
  const places = welcomeSteps("").find((s) => s.target === "menu")!;
  for (const p of PLACES) assert.match(places.body, new RegExp(`\\b${p.label}\\b`));
  assert.doesNotMatch(places.body, /\b(Today|Build|Proof)\b/);
});

test("what's-new steps point at a real anchor or none", () => {
  const have = anchors();
  for (const s of whatsNewSteps(UPDATES.filter((u) => u.kind !== "Next"))) {
    if (s.target) assert.ok(have.has(s.target), `no element carries data-tour="${s.target}"`);
  }
});

// The card never sits on what the step lights up (placeCard).
const overlaps = (c: { left: number; top: number; width: number }, h: number, b: TourBox) =>
  Math.min(c.left + c.width, b.left + b.width) > Math.max(c.left, b.left) && Math.min(c.top + h, b.top + b.height) > Math.max(c.top, b.top);

test("the card moves off the highlighted element, wherever it is on a desktop", () => {
  const W = 1440, H = 950, h = 220;
  const targets: TourBox[] = [
    { top: 700, left: 1000, width: 400, height: 200 }, // bottom right, under the card's usual spot
    { top: 20, left: 1000, width: 400, height: 60 }, // top right
    { top: 300, left: 260, width: 900, height: 380 }, // the middle, wide (a profile's proof)
    { top: 120, left: 8, width: 240, height: 760 }, // the sidebar
    { top: 380, left: 300, width: 1100, height: 180 }, // a full-width band across the middle
  ];
  for (const b of targets) {
    const c = placeCard(b, h, W, H);
    assert.ok(!overlaps(c, h, b), `card at ${c.left},${c.top} covers the target at ${b.left},${b.top}`);
    assert.ok(c.left >= 0 && c.left + c.width <= W && c.top >= 0 && c.top + h <= H, "card is off the screen");
  }
  // With nothing to point at, it sits in its usual corner, bottom right.
  const c = placeCard(null, h, W, H);
  assert.deepEqual([c.left, c.top], [W - 24 - 400, H - 24 - h]);
});

test("on a phone the card goes to the top when the target is low, and stays low otherwise", () => {
  const W = 390, H = 844, h = 240;
  const tabBar: TourBox = { top: 760, left: 12, width: 366, height: 70 };
  const searchBar: TourBox = { top: 70, left: 10, width: 370, height: 52 };
  const low = placeCard(tabBar, h, W, H), high = placeCard(searchBar, h, W, H);
  assert.ok(!overlaps(low, h, tabBar) && low.top < tabBar.top, "covers the tab bar");
  assert.ok(!overlaps(high, h, searchBar) && high.top > searchBar.top, "covers the search bar");
  assert.equal(low.width, W - 32);
});
