// Every database step can reach production (Linear FIX-67). The production migration
// (.github/workflows/db-migrate.yml) only applies steps that supabase/maintenance/health-check.sql can
// see, and refuses to run if the newest step in supabase/order.txt has no row there. That check ran
// only after merging: PR #34 merged who-looked.sql without its row and the migration stopped. This
// runs the same checks on every pull request.
// Run: npm test
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(__dirname, "..", "..");
const steps = readFileSync(join(ROOT, "supabase", "order.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const health = readFileSync(join(ROOT, "supabase", "maintenance", "health-check.sql"), "utf8");
// Block 1 of the health check, as db-migrate.yml cuts it out: from "select step, file" to "order by step;".
const block = health.slice(health.indexOf("select step, file"), health.indexOf("order by step;"));
const rows = [...block.matchAll(/\(\s*(\d+)\s*,\s*'([a-z0-9-]+)'/g)].map((m) => ({ n: Number(m[1]), file: m[2] }));

test("the health check's step list is where db-migrate.yml looks for it", () => {
  assert.ok(block.length > 0 && rows.length > 0, "block 1 must run from \"select step, file\" to \"order by step;\"");
});

test("the newest step in order.txt has a row in the health check (or production never gets it)", () => {
  const newest = steps[steps.length - 1];
  assert.ok(rows.some((r) => r.file === newest), `add a row for '${newest}' to supabase/maintenance/health-check.sql`);
});

test("every step the health check lists is a real file in order.txt, in the same order", () => {
  for (const r of rows) {
    assert.ok(existsSync(join(ROOT, "supabase", `${r.file}.sql`)), `${r.file}.sql doesn't exist`);
    assert.ok(steps.includes(r.file), `${r.file} isn't in order.txt`);
  }
  const listed = rows.slice().sort((a, b) => a.n - b.n).map((r) => r.file);
  const inOrder = steps.filter((s) => listed.includes(s));
  assert.deepEqual(listed, inOrder, "health-check numbers must follow order.txt's order");
});

test("step numbers in the health check are unique", () => {
  const ns = rows.map((r) => r.n);
  assert.equal(new Set(ns).size, ns.length);
});
