// "Help me ask someone who saw my latest milestone to sign it" is Torch's own button, but on production
// Torch answered "I don't have dates to tell which is latest" and guessed. A waiting milestone now
// carries the day it happened, and the list is newest first by that day (lib/ember-record.ts).
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_RECORD, newestFirst, recordLines, type EmberRecord, type OpenMilestone } from "@/lib/ember-record";

const open = (o: Partial<OpenMilestone>): OpenMilestone => ({ id: "m1", title: "Check-in time from 48 s to 19 s", project_id: "p1", club: false, asked: [], on: "2026-11-03", ...o });
const rec = (r: Partial<EmberRecord>): EmberRecord => ({ ...EMPTY_RECORD, projects: [{ id: "p1", title: "Clinic check-in kiosk" }], ...r });

test("newest first goes by the day on the milestone, not the order the rows came in", () => {
  const rows = [{ id: "old", on: "2026-10-01" }, { id: "new", on: "2026-11-20" }, { id: "mid", on: "2026-11-03" }];
  assert.deepEqual(newestFirst(rows).map((r) => r.id), ["new", "mid", "old"]);
  assert.deepEqual(rows.map((r) => r.id), ["old", "new", "mid"], "the rows passed in are left as they were");
});

test("two from the same day keep the order they came in, and one with no day goes last", () => {
  const rows = [{ id: "undated", on: "" }, { id: "a", on: "2026-11-20" }, { id: "b", on: "2026-11-20" }];
  assert.deepEqual(newestFirst(rows).map((r) => r.id), ["a", "b", "undated"]);
});

test("Torch is told each waiting milestone's day, and that the list runs newest first", () => {
  const line = recordLines(rec({ open: [open({ id: "m2", title: "Offline mode", on: "2026-11-20" }), open({})] })).find((l) => l.startsWith("Waiting for proof")) ?? "";
  assert.match(line, /newest first/);
  assert.match(line, /"Offline mode" \(2026-11-20; milestone id m2;/);
  assert.match(line, /"Check-in time from 48 s to 19 s" \(2026-11-03; milestone id m1;/);
});

test("a milestone with no day on it reads cleanly, with nothing where the day would be", () => {
  const line = recordLines(rec({ open: [open({ on: "" })] })).find((l) => l.startsWith("Waiting for proof")) ?? "";
  assert.match(line, /"Check-in time from 48 s to 19 s" \(milestone id m1;/);
  assert.doesNotMatch(line, /undefined|\(;/);
});
