// Jig reads the member's proven work and what's new, and prepares a project update (Linear FIX-216).
// On the real tool code, with a database that refuses every write:
//  - my_record returns only work someone stood behind, in the record's own words for who signed it;
//  - whats_new lists unread notifications first;
//  - propose_project_edit hands over a card with what's there now beside the change, for the owner only.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Proposal } from "@/lib/copilot-agent";
import { TOOLS, makeExec, openMilestones } from "@/lib/copilot-tools";

const ME = "00000000-0000-0000-0000-000000000001";
type Tables = Record<string, unknown[]>;

function readOnlyDb(tables: Tables) {
  const writes: string[] = [];
  const builder = (table: string): unknown => {
    const rows = tables[table] ?? [];
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "or", "order", "limit", "gt", "gte", "lt", "lte", "is", "not"]) b[m] = () => b;
    for (const m of ["insert", "update", "delete", "upsert"]) b[m] = () => { writes.push(`${m} ${table}`); throw new Error(`WRITE ATTEMPT: ${m} on ${table}`); };
    b.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok);
    return b;
  };
  // db-features probes: every "<step>_ready" answers, so each feature reads as switched on.
  const db = { from: (t: string) => builder(t), rpc: (name: string) => { if (/_ready$/.test(name)) return Promise.resolve({ data: true, error: null }); writes.push(`rpc ${name}`); throw new Error(`WRITE ATTEMPT: rpc ${name}`); } };
  return { db: db as never, writes };
}
const run = async (tool: string, args: Record<string, unknown>, tables: Tables) => {
  const { db, writes } = readOnlyDb(tables);
  const cards: Proposal[] = [];
  const result = (await makeExec(db, ME, (p) => cards.push(p))(tool, args)) as Record<string, unknown>;
  return { result, cards, writes };
};

const RECORD: Tables = {
  projects: [{ id: "p1", title: "Clinic check-in kiosk", summary: "Self check-in for a clinic" }],
  project_details: [{ details: "Old write-up", link: "https://github.com/acme/kiosk" }],
  milestones: [
    { project_id: "p1", title: "Check-in time from 48 s to 19 s", detail: "Median over a week", evidence: "https://github.com/acme/kiosk/pull/212", achieved_on: "2026-11-12", status: "verified", vouched_by: "Sam Rivera, Staff Engineer · northwind.example (company not verified)", private: false },
    { project_id: "p1", title: "Thrust stand reads within 2%", achieved_on: "2025-04-02", status: "verified", reviewer_name: "Ben Cho", community_name: "Rocketry Club", private: true },
    { project_id: "p1", title: "Retry fix merged", achieved_on: "2026-10-01", status: "logged", milestone_backings: [{ repo_full_name: "acme/kiosk", ref: "230" }] },
    { project_id: "p1", title: "Offline mode", achieved_on: "2026-11-19", status: "draft" },
    { project_id: "p1", title: "Declined thing", achieved_on: "2026-09-01", status: "declined" },
  ],
};

test("the three tools are offered, and the one that prepares a change says it waits", () => {
  for (const n of ["my_record", "whats_new", "propose_project_edit"]) assert.ok(TOOLS.some((t) => t.name === n), n);
  assert.match(String(TOOLS.find((t) => t.name === "propose_project_edit")!.description), /NOT saved until they confirm/);
});

test("my_record: only work someone stood behind, with who, by year", async () => {
  const { result, writes } = await run("my_record", {}, RECORD);
  assert.deepEqual(writes, []);
  const proven = result.proven as { title: string; proof: string; project: string; shown_on_profile: boolean }[];
  assert.deepEqual(proven.map((m) => m.title), ["Check-in time from 48 s to 19 s", "Thrust stand reads within 2%", "Retry fix merged"]);
  assert.equal(proven[0].proof, "signed by Sam Rivera, Staff Engineer · northwind.example (company not verified)");
  assert.equal(proven[1].proof, "verified by Ben Cho of Rocketry Club");
  assert.equal(proven[2].proof, "backed by GitHub (acme/kiosk#230)");
  assert.equal(proven[0].project, "Clinic check-in kiosk");
  assert.equal(proven[0].shown_on_profile, true);
  assert.equal(proven[1].shown_on_profile, false, "a private result is marked, so Jig can say so");
  assert.deepEqual(result.by_year, { "2026": 2, "2025": 1 });
  assert.equal(result.proven_total, 3);
  assert.equal(result.still_waiting, 1, "a declined one is neither proven nor waiting");
  assert.equal(result.link, `/u/${ME}`);
});

test("my_record on an empty record says so with zeros, not an error", async () => {
  const { result } = await run("my_record", { since: "2026-06-01" }, { projects: [], milestones: [] });
  assert.deepEqual(result.proven, []);
  assert.equal(result.proven_total, 0);
});

test("whats_new: unread first, in plain words", async () => {
  const notes = [
    { kind: "milestone_verified", actor_first: "Sam Rivera", actor_last: "", community_name: "", snippet: "Check-in time from 48 s to 19 s", created_at: "2026-11-20T10:00:00Z", read: false },
    { kind: "reply", actor_first: "Leo", actor_last: "Park", community_name: "", snippet: "Nice", created_at: "2026-11-19T10:00:00Z", read: true },
  ];
  const { result, writes } = await run("whats_new", {}, { notifications: notes });
  assert.deepEqual(writes, []);
  assert.equal(result.unread, 1);
  const items = result.items as { what: string; from: string; about: string }[];
  assert.equal(items.length, 1, "with something unread, only the unread show");
  assert.deepEqual({ what: items[0].what, from: items[0].from, about: items[0].about }, { what: "milestone verified", from: "Sam Rivera", about: "Check-in time from 48 s to 19 s" });
  const none = await run("whats_new", {}, { notifications: [notes[1]] });
  assert.equal(none.result.unread, 0);
  assert.equal((none.result.items as unknown[]).length, 1, "with nothing unread, the latest still show");
});

test("propose_project_edit: a card with what's there now, only the fields that change, nothing written", async () => {
  const { result, cards, writes } = await run("propose_project_edit", { project_id: "p1", summary: "  Self check-in that cut the line from 12 to 4 minutes  " }, RECORD);
  assert.equal(result.shown_to_member, true);
  assert.deepEqual(writes, []);
  assert.equal(cards.length, 1);
  const { id, ...card } = cards[0];
  assert.ok(id);
  assert.deepEqual(card, { kind: "project_edit", project_id: "p1", project_title: "Clinic check-in kiosk", summary: "Self check-in that cut the line from 12 to 4 minutes", before: { summary: "Self check-in for a clinic", details: "Old write-up", link: "https://github.com/acme/kiosk", specs: [] } });
});

test("propose_project_edit refuses nothing-to-change, a bad link and someone else's project", async () => {
  assert.match(String((await run("propose_project_edit", { project_id: "p1" }, RECORD)).result.error), /what should change/);
  assert.match(String((await run("propose_project_edit", { project_id: "p1", link: "http://insecure.example" }, RECORD)).result.error), /https/);
  const other = await run("propose_project_edit", { project_id: "p9", summary: "x" }, { projects: [], project_details: [] });
  assert.match(String(other.result.error), /only the owner/);
  assert.equal(other.cards.length, 0);
});

// "My latest milestone" needs a day to go by: on production Jig said it had no dates and guessed.
// my_profile itself needs a request to run in, so this pins the list it returns.
test("my_profile's waiting milestones come newest first by their day, each with its date", () => {
  const open = openMilestones([
    { id: "m-old", project_id: "p1", title: "Older", status: "draft", community_id: null, achieved_on: "2026-11-03" },
    { id: "m-signed", project_id: "p1", title: "Signed", status: "verified", community_id: null, achieved_on: "2026-11-21" },
    { id: "m-new", project_id: "p1", title: "Newer", status: "pending", community_id: "c1", achieved_on: "2026-11-20" },
    { id: "m-undated", project_id: "p1", title: "No day", status: "draft", community_id: null },
  ]);
  assert.deepEqual(open.map((m) => [m.id, m.date]), [["m-new", "2026-11-20"], ["m-old", "2026-11-03"], ["m-undated", undefined]]);
  assert.deepEqual(open.map((m) => m.waiting_on), ["a club", "a person who saw it", "a person who saw it"]);
});
