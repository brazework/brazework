// Your last 90 days from GitHub (lib/recent-work-pick.ts): which merged pull requests are offered for
// one-tap adding. Only the member's own, only recent ones, never one already on a record, newest
// first, with the link built from the repo and number. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADD_MAX, RECENT_MAX, addedMessage, milestoneTitleFrom, pickRecentWork, workKey, type MergedEvent } from "@/lib/recent-work-pick";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const repos = [{ repo_id: 4242, full_name: "bencho/flight-computer" }];
const ev = (ref: string, actor: string, daysAgo: number, title = `Merged #${ref}: Work ${ref}`, repo_id = 4242): MergedEvent =>
  ({ repo_id, ref, actor, title, occurred_at: new Date(NOW - daysAgo * 864e5).toISOString() });

test("only the member's own merged pull requests, newest first, with the link built here", () => {
  const got = pickRecentWork({ events: [ev("21", "bencho", 30), ev("23", "someone-else", 2), ev("22", "BenCho", 5), ev("9", "bencho", 5, undefined, 9999)], login: "bencho", repos, backed: new Set(), now: NOW });
  assert.deepEqual(got.map((w) => w.ref), ["22", "21"], "newest first; a teammate's and an unlinked repo's are left out; logins compare without case");
  assert.deepEqual(got[0], { repoId: 4242, repo: "bencho/flight-computer", ref: "22", title: "Work 22", url: "https://github.com/bencho/flight-computer/pull/22", mergedOn: "2026-11-14" });
});

test("nothing older than 90 days, nothing already on a record, nothing twice", () => {
  const events = [ev("30", "bencho", 89), ev("31", "bencho", 91), ev("32", "bencho", 3), ev("32", "bencho", 3), ev("33", "bencho", 4)];
  const got = pickRecentWork({ events, login: "bencho", repos, backed: new Set([workKey("BenCho/Flight-Computer", "33")]), now: NOW });
  assert.deepEqual(got.map((w) => w.ref), ["32", "30"]);
});

test("without the member's login, or with odd numbers, nothing is offered", () => {
  assert.deepEqual(pickRecentWork({ events: [ev("21", "bencho", 1)], login: " ", repos, backed: new Set(), now: NOW }), []);
  assert.deepEqual(pickRecentWork({ events: [ev("0", "bencho", 1), ev("12/files", "bencho", 1), ev("../x", "bencho", 1), { ...ev("5", "bencho", 1), occurred_at: "not a date" }], login: "bencho", repos, backed: new Set(), now: NOW }), []);
});

test("a long history is offered a screenful at a time", () => {
  const many = Array.from({ length: 60 }, (_, i) => ev(String(100 + i), "bencho", i));
  assert.equal(pickRecentWork({ events: many, login: "bencho", repos, backed: new Set(), now: NOW }).length, RECENT_MAX);
  assert.ok(ADD_MAX <= RECENT_MAX);
});

test("the milestone's title is the pull request's, cleaned up", () => {
  assert.equal(milestoneTitleFrom("Merged #12: Fix the   telemetry parser", "12"), "Fix the telemetry parser");
  assert.equal(milestoneTitleFrom("Merged #12: ", "12"), "Merged pull request #12");
  assert.equal(milestoneTitleFrom("Bump deps", "7"), "Bump deps");
  assert.ok(milestoneTitleFrom(`Merged #1: ${"x".repeat(300)}`, "1").length <= 120);
});

test("what happened, said plainly: how many, what's hidden, what was left out", () => {
  assert.equal(addedMessage({ added: 3, hidden: 0, skipped: 0 }), "Added 3 to your record, backed by GitHub.");
  assert.equal(addedMessage({ added: 3, hidden: 1, skipped: 0 }), "Added 3 to your record, backed by GitHub. 1 is from a private repo, so only you see it until you choose to show it.");
  assert.equal(addedMessage({ added: 2, hidden: 2, skipped: 1 }), "Added 2 to your record, backed by GitHub. They're from a private repo, so only you see them until you choose to show them. 1 couldn't be confirmed and was left out.");
  assert.equal(addedMessage({ added: 1, hidden: 1, skipped: 0 }), "Added 1 to your record, backed by GitHub. It's from a private repo, so only you see it until you choose to show it.");
  assert.match(addedMessage({ added: 0, hidden: 0, skipped: 2 }), /Nothing was saved/);
  assert.equal(addedMessage({ added: 0, hidden: 0, skipped: 0 }), "Pick at least one to add.");
  for (const m of [addedMessage({ added: 3, hidden: 1, skipped: 1 })]) assert.doesNotMatch(m, /verified|signed/i, "backed is never called signed");
});
