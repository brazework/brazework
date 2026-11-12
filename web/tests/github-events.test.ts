// GitHub webhooks -> build-log entries (Linear FIX-92, phase 3): only genuine deliveries, and only
// progress. Run: npm test
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { eventsFrom, removedRepos, verifySignature } from "../src/lib/github-events";

const SECRET = "whsec_test";
const sign = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const repo = { id: 77, full_name: "ben/test-stand", html_url: "https://github.com/ben/test-stand", default_branch: "main" };

test("a delivery is genuine only with GitHub's signature of the exact body, under our secret", () => {
  const body = JSON.stringify({ zen: "Keep it logically awesome." });
  assert.equal(verifySignature(SECRET, body, sign(body)), true);
  assert.equal(verifySignature(SECRET, `${body} `, sign(body)), false, "a changed body");
  assert.equal(verifySignature(SECRET, body, sign(body, "someone-else")), false, "another secret");
  assert.equal(verifySignature(SECRET, body, null), false, "no signature");
  assert.equal(verifySignature(SECRET, body, "sha1=abc"), false, "the old SHA-1 header");
  assert.equal(verifySignature(undefined, body, sign(body)), false, "no secret configured: refuse, never accept");
});

test("a merged pull request is progress; opened or closed without merging isn't", () => {
  const pr = { number: 42, title: "Add igniter sequencing\n\nlong body", html_url: "https://github.com/ben/test-stand/pull/42", merged: true, merged_at: "2026-11-12T10:00:00Z", user: { login: "bencho" } };
  assert.deepEqual(eventsFrom("pull_request", { action: "closed", pull_request: pr, repository: repo }), [{
    repo_id: 77, kind: "pr_merged", title: "Merged #42: Add igniter sequencing", url: pr.html_url, actor: "bencho", ref: "42", state: "", occurred_at: "2026-11-12T10:00:00Z", source_id: "pr:42",
  }]);
  assert.deepEqual(eventsFrom("pull_request", { action: "opened", pull_request: { ...pr, merged: false, merged_at: null }, repository: repo }), []);
  assert.deepEqual(eventsFrom("pull_request", { action: "closed", pull_request: { ...pr, merged: false, merged_at: null }, repository: repo }), []);
});

test("a published release counts (pre-releases say so); drafts don't", () => {
  const r = { id: 9001, tag_name: "v1.0.0", name: "First hot fire", html_url: "https://github.com/ben/test-stand/releases/tag/v1.0.0", published_at: "2026-11-12T11:00:00Z", author: { login: "bencho" } };
  const [e] = eventsFrom("release", { action: "published", release: r, repository: repo });
  assert.equal(e.title, "Released First hot fire");
  assert.equal(e.source_id, "release:9001");
  assert.equal(eventsFrom("release", { action: "published", release: { ...r, prerelease: true }, repository: repo })[0].title, "Released First hot fire (pre-release)");
  assert.deepEqual(eventsFrom("release", { action: "created", release: { ...r, draft: true }, repository: repo }), []);
});

test("CI counts when it finishes on the default branch, passed or failed; other branches and neutral results don't", () => {
  const cs = { head_branch: "main", head_sha: "abc123", conclusion: "success", updated_at: "2026-11-12T12:00:00Z" };
  const [e] = eventsFrom("check_suite", { action: "completed", check_suite: cs, repository: repo });
  assert.deepEqual([e.title, e.state, e.url, e.source_id], ["CI passed on main", "success", "https://github.com/ben/test-stand/commit/abc123", "ci:abc123"]);
  assert.equal(eventsFrom("check_suite", { action: "completed", check_suite: { ...cs, conclusion: "failure" }, repository: repo })[0].title, "CI failed on main");
  assert.deepEqual(eventsFrom("check_suite", { action: "completed", check_suite: { ...cs, head_branch: "feature" }, repository: repo }), []);
  assert.deepEqual(eventsFrom("check_suite", { action: "completed", check_suite: { ...cs, conclusion: "neutral" }, repository: repo }), []);
});

test("a successful deploy counts, linking to the live site when it's https; failed ones don't", () => {
  const ok = { deployment: { id: 5, environment: "Production" }, deployment_status: { state: "success", environment_url: "https://stand.vercel.app", created_at: "2026-11-12T13:00:00Z" }, repository: repo };
  const [e] = eventsFrom("deployment_status", ok);
  assert.deepEqual([e.title, e.url, e.source_id], ["Deployed to Production", "https://stand.vercel.app", "deploy:5"]);
  assert.equal(eventsFrom("deployment_status", { ...ok, deployment_status: { ...ok.deployment_status, environment_url: "javascript:alert(1)" } })[0].url, repo.html_url, "only https links");
  assert.deepEqual(eventsFrom("deployment_status", { ...ok, deployment_status: { ...ok.deployment_status, state: "failure" } }), []);
});

test("pushes count on the default branch only, as one entry per push", () => {
  const push = { ref: "refs/heads/main", compare: "https://github.com/ben/test-stand/compare/a...b", commits: [{ message: "a" }, { message: "b" }], head_commit: { id: "bbb", message: "Tune the regulator\n\ndetails", timestamp: "2026-11-12T14:00:00Z" }, pusher: { name: "bencho" }, repository: repo };
  const [e] = eventsFrom("push", push);
  assert.deepEqual([e.title, e.url, e.source_id], ["2 commits to main: Tune the regulator", push.compare, "push:bbb"]);
  assert.deepEqual(eventsFrom("push", { ...push, ref: "refs/heads/feature" }), []);
  assert.deepEqual(eventsFrom("push", { ...push, deleted: true }), []);
  assert.deepEqual(eventsFrom("push", { ...push, commits: [] }), [], "a tag or empty push");
});

test("unknown events, or payloads without a repo, add nothing; removed repos are listed", () => {
  assert.deepEqual(eventsFrom("star", { action: "created", repository: repo }), []);
  assert.deepEqual(eventsFrom("pull_request", { action: "closed" }), []);
  assert.deepEqual(removedRepos("installation_repositories", { action: "removed", repositories_removed: [{ id: 77 }, { id: 78 }] }), [77, 78]);
  assert.deepEqual(removedRepos("installation_repositories", { action: "added", repositories_added: [{ id: 79 }] }), []);
});
