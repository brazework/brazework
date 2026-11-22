// The guided tour (FIX-236): every step points at something the app really renders, and the welcome
// tour talks about the five places by their current names. Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PLACES } from "@/lib/places";
import { UPDATES, WELCOME_TARGETS, welcomeSteps, whatsNewSteps } from "@/lib/tours";

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
