// "Backed by GitHub" (lib/backing.ts, Linear FIX-121): which evidence links can be checked, and
// when GitHub's answer backs the member's claim. Only their own GitHub account counts, compared by
// id (usernames can change). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { backingMessage, judgeBacking, parseGitHubEvidence } from "@/lib/backing";

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
