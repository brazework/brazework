// Every scheduled job has a schedule (Linear FIX-86). The weekly digest's route existed for weeks with
// nothing calling it: a cron job with no schedule fails silently. This fails CI instead.
// Run: npm test
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const WEB = join(__dirname, "..");
const cronDir = join(WEB, "src", "app", "api", "cron");
const routes = existsSync(cronDir) ? readdirSync(cronDir).filter((d) => existsSync(join(cronDir, d, "route.ts"))).map((d) => `/api/cron/${d}`) : [];
const config = JSON.parse(readFileSync(join(WEB, "vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };

test("every /api/cron route is scheduled in vercel.json, and every schedule points at a real route", () => {
  const scheduled = (config.crons ?? []).map((c) => c.path.split("?")[0]);
  assert.deepEqual(routes.filter((r) => !scheduled.includes(r)), [], "add a crons entry in web/vercel.json");
  assert.deepEqual(scheduled.filter((p) => !routes.includes(p)), [], "a schedule points at a route that doesn't exist");
});

test("schedules are valid 5-field cron expressions", () => {
  for (const c of config.crons ?? []) assert.match(c.schedule, /^(\S+\s+){4}\S+$/, `${c.path}: "${c.schedule}"`);
});

test("cron routes check CRON_SECRET (anyone could trigger them otherwise)", () => {
  for (const r of routes) {
    const src = readFileSync(join(WEB, "src", "app", r.replace(/^\//, ""), "route.ts"), "utf8");
    assert.match(src, /CRON_SECRET/, `${r} must check Authorization: Bearer $CRON_SECRET`);
  }
});
