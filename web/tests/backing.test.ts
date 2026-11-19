// "Backed by GitHub" (lib/backing.ts, Linear FIX-121): which evidence links can be checked, and
// when GitHub's answer backs the member's claim. Only their own GitHub account counts, compared by
// id (usernames can change). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { approvalsFor, approvedLine, approversOf, backingMessage, judgeBacking, parseGitHubEvidence, type GitHubReview } from "@/lib/backing";

test("commit, pull request and release links are recognised", () => {
  assert.deepEqual(parseGitHubEvidence("https://github.com/bencho/flight-computer/commit/9fceb02d0ae598e95dc970b74767f19372d61af8"),
    { fullName: "bencho/flight-computer", kind: "commit", ref: "9fceb02d0ae598e95dc970b74767f19372d61af8" });
  assert.deepEqual(parseGitHubEvidence("https://github.com/bencho/flight-computer/pull/12/files"), { fullName: "bencho/flight-computer", kind: "pull_request", ref: "12" });
  assert.deepEqual(parseGitHubEvidence("https://github.com/bencho/flight-computer/releases/tag/v0.3"), { fullName: "bencho/flight-computer", kind: "release", ref: "v0.3" });
  assert.deepEqual(parseGitHubEvidence("https://github.com/Ben-Cho/flight.computer/commit/9fceb02#diff"), { fullName: "Ben-Cho/flight.computer", kind: "commit", ref: "9fceb02" });
});

test("anything else can't be backed", () => {
  for (const u of [
    "https://github.com/bencho/flight-computer", "https://github.com/bencho/flight-computer/issues/3",
    "http://github.com/bencho/flight-computer/pull/12", "https://gist.github.com/bencho/abc", "https://github.com.evil.test/bencho/x/pull/1",
    "https://example.com/bencho/x/commit/abcdef1", "https://github.com/bencho/x/commit/zzz", "https://github.com/bencho/x/pull/0", "",
  ]) assert.equal(parseGitHubEvidence(u), null, u);
});

test("backed only when GitHub says the member's own account made it", () => {
  assert.deepEqual(judgeBacking("commit", { authorId: 501 }, 501), { ok: true });
  assert.deepEqual(judgeBacking("commit", { authorId: 777 }, 501), { ok: false, reason: "other_author" });
  assert.deepEqual(judgeBacking("commit", { authorId: null }, 501), { ok: false, reason: "other_author" });
  assert.deepEqual(judgeBacking("pull_request", { authorId: 501, merged: true }, 501), { ok: true });
  assert.deepEqual(judgeBacking("pull_request", { authorId: 501, merged: false }, 501), { ok: false, reason: "not_merged" });
  assert.deepEqual(judgeBacking("release", { authorId: 501, draft: false }, 501), { ok: true });
  assert.deepEqual(judgeBacking("release", { authorId: 501, draft: true }, 501), { ok: false, reason: "draft" });
  assert.deepEqual(judgeBacking("commit", { authorId: 501 }, null), { ok: false, reason: "no_account" });
  assert.deepEqual(judgeBacking("commit", { authorId: 501, landed: false }, 501), { ok: false, reason: "not_landed" });
  assert.deepEqual(judgeBacking("commit", { authorId: 501, landed: true }, 501), { ok: true });
});

test("every reason reads as a plain sentence", () => {
  for (const r of ["not_github", "not_linked", "no_account", "other_author", "not_merged", "not_landed", "draft", "unreachable", "off", "already_used"] as const) {
    const m = backingMessage(r);
    assert.ok(m.length > 20 && /\.$/.test(m) && !/error|code/i.test(m), r);
  }
});

// ---------- Approved by (supabase/approved-by.sql) ----------
const rv = (id: number, login: string, state: string, at: string, type = "User"): GitHubReview => ({ user: { id, login, type }, state, submitted_at: at });

test("an approval counts when it's the reviewer's latest decision, and never the author's or a bot's", () => {
  const reviews = [
    rv(601, "sam-rivera", "COMMENTED", "2026-11-01T10:00:00Z"),
    rv(601, "sam-rivera", "APPROVED", "2026-11-01T11:00:00Z"),
    rv(602, "lee-park", "CHANGES_REQUESTED", "2026-11-01T09:00:00Z"),
    rv(602, "lee-park", "APPROVED", "2026-11-02T09:00:00Z"),
    rv(603, "kim-ito", "APPROVED", "2026-11-01T08:00:00Z"),
    rv(603, "kim-ito", "DISMISSED", "2026-11-02T08:00:00Z"),
    rv(604, "dana-ruiz", "APPROVED", "2026-11-01T07:00:00Z"),
    rv(604, "dana-ruiz", "CHANGES_REQUESTED", "2026-11-03T07:00:00Z"),
    rv(501, "bencho", "APPROVED", "2026-11-01T12:00:00Z"),
    rv(900, "ci-approver[bot]", "APPROVED", "2026-11-01T12:30:00Z", "Bot"),
    rv(605, "noor-h", "APPROVED", "2026-11-01T06:00:00Z"),
    rv(605, "noor-h", "COMMENTED", "2026-11-04T06:00:00Z"),
    { user: null, state: "APPROVED", submitted_at: "2026-11-01T05:00:00Z" },
  ];
  assert.deepEqual(approversOf(reviews, 501).map((a) => a.login), ["noor-h", "sam-rivera", "lee-park"], "oldest standing approval first; a later comment doesn't undo one");
  assert.deepEqual(approversOf([], 501), []);
  assert.deepEqual(approversOf([rv(700, "not a login", "APPROVED", "2026-11-01T00:00:00Z")], 501), [], "nothing that isn't a GitHub login");
});

test("a private repo keeps the count and never the names", () => {
  const reviews = [rv(601, "sam-rivera", "APPROVED", "2026-11-01T11:00:00Z"), rv(602, "lee-park", "APPROVED", "2026-11-02T09:00:00Z")];
  assert.deepEqual(approvalsFor(reviews, 501, false), { approvals: 2, approvers: ["sam-rivera", "lee-park"] });
  assert.deepEqual(approvalsFor(reviews, 501, true), { approvals: 2, approvers: [] });
  const many = Array.from({ length: 14 }, (_, i) => rv(700 + i, `dev${i}`, "APPROVED", `2026-11-01T00:${String(i).padStart(2, "0")}:00Z`));
  const kept = approvalsFor(many, 501, false);
  assert.equal(kept.approvals, 14);
  assert.equal(kept.approvers.length, 10, "at most 10 names");
});

test("the line says who approved, or how many, and nothing when nobody did", () => {
  assert.equal(approvedLine({ approvals: 1, approvers: ["sam-rivera"] }), "approved by @sam-rivera");
  assert.equal(approvedLine({ approvals: 2, approvers: ["sam-rivera", "lee-park"] }), "approved by @sam-rivera and @lee-park");
  assert.equal(approvedLine({ approvals: 4, approvers: ["sam-rivera", "lee-park", "a", "b"] }), "approved by @sam-rivera and 3 others");
  assert.equal(approvedLine({ approvals: 2, approvers: ["sam-rivera"] }), "approved by @sam-rivera and 1 other");
  assert.equal(approvedLine({ approvals: 1, approvers: [] }), "approved by 1 reviewer");
  assert.equal(approvedLine({ approvals: 3, approvers: [] }), "approved by 3 reviewers");
  for (const none of [null, undefined, {}, { approvals: 0, approvers: ["sam-rivera"] }, { approvals: null, approvers: null }]) assert.equal(approvedLine(none), "");
  assert.equal(approvedLine({ approvals: 1, approvers: ["<b>x</b>"] }), "approved by 1 reviewer", "a stored value that isn't a login is never shown");
  for (const l of [approvedLine({ approvals: 1, approvers: ["sam-rivera"] }), approvedLine({ approvals: 3, approvers: [] })]) assert.doesNotMatch(l, /verified|signed|vouched/i, "an approval is never called a signature");
});
