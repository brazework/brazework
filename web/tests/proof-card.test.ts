// Proof cards (lib/proof-card.ts, Linear FIX-128): how a shared result reads on its public page, in its
// preview image and in a post. A signed result names its witness; a backed one says what GitHub
// checked and never says "verified". Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { proofBadge, proofPostText, proofUrl, shareLinks, waitingFor, type PublicProof } from "@/lib/proof-card";

const base: PublicProof = {
  id: "abc", title: "Beat the course in 41.2 seconds", detail: "Best of 3 runs.", achieved_on: "2026-11-16", level: "signed", project: "Line-following robot",
  member: { id: "u1", first: "Maya", last: "Patel", headline: "Avionics", avatar: "" },
  witness: { name: "Ben Cho", role: "owner", club: "Rocketry Club", vouched_by: "", at: "2026-11-16T15:00:00Z" }, backing: null, image: null, shared_at: "2026-11-17T00:00:00Z",
};

test("a signed result names its witness, their role, the club and the date", () => {
  assert.equal(proofBadge(base), "Verified by Ben Cho (owner), Rocketry Club · Nov 16, 2026");
  assert.equal(proofBadge({ ...base, witness: { ...base.witness!, vouched_by: "Dana Ruiz, Engineering manager · voltline.com" } }), "Signed by Dana Ruiz, Engineering manager · voltline.com · Nov 16, 2026");
});

test("a backed result says what GitHub checked, and never 'verified'", () => {
  const b: PublicProof = { ...base, level: "backed", witness: null, backing: { kind: "pull_request", repo: "mayapatel/line-follower", ref: "7", url: "https://github.com/mayapatel/line-follower/pull/7" } };
  assert.equal(proofBadge(b), "Backed by GitHub · PR #7 in mayapatel/line-follower");
  assert.ok(!/verified/i.test(proofBadge(b)));
  assert.equal(proofBadge({ ...b, backing: { ...b.backing!, kind: "commit", ref: "9fceb02d0ae598e95dc970b74767f19372d61af8" } }), "Backed by GitHub · commit 9fceb02 in mayapatel/line-follower");
});

test("links: the page, and posts to LinkedIn and X that carry it", () => {
  const url = proofUrl("https://brazework.com", "abc");
  assert.equal(url, "https://brazework.com/p/abc");
  const l = shareLinks(url, proofPostText(base));
  assert.equal(l.linkedin, "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fbrazework.com%2Fp%2Fabc");
  assert.ok(l.x.startsWith("https://x.com/intent/post?text=") && l.x.includes("url=https%3A%2F%2Fbrazework.com%2Fp%2Fabc"));
  assert.equal(proofPostText(base), "Beat the course in 41.2 seconds. Verified by Ben Cho, Rocketry Club, on Brazework.");
});

test("a waiting card says plainly it isn't signed, and who was asked, never their address", () => {
  const base = { id: "w", title: "Load cell calibrated", detail: "", achieved_on: "2026-11-19", project: "Rig", member: { id: "u", first: "Ben", last: "Cho", headline: "", avatar: "" }, witness: null, backing: null, image: null, shared_at: "" } as const;
  const club = { ...base, level: "waiting" as const, waiting_for: { club: "Rocketry Club", asked: null } };
  const prof = { ...base, level: "waiting" as const, waiting_for: { club: null, asked: { relationship: "professor", domain: "utexas.edu" } } };
  assert.equal(proofBadge(club), "Not signed yet · waiting for Rocketry Club to verify");
  assert.equal(proofBadge(prof), "Not signed yet · waiting for a professor at utexas.edu to sign");
  assert.equal(waitingFor(prof), "a professor at utexas.edu");
  assert.match(proofPostText(prof), /waiting for a professor at utexas\.edu to sign/);
  assert.doesNotMatch(proofPostText(prof) + proofBadge(prof), /verified|signed by/i);
  assert.match(proofBadge({ ...base, level: "waiting" as const, waiting_for: null }), /waiting for the person who saw it/);
});

test("a backed pull request names who approved it on GitHub, and still isn't called signed", () => {
  const b: PublicProof = { ...base, level: "backed", witness: null, backing: { kind: "pull_request", repo: "acme/checkout", ref: "1187", url: "https://github.com/acme/checkout/pull/1187", approvals: 2, approvers: ["sam-rivera", "lee-park"] } };
  assert.equal(proofBadge(b), "Backed by GitHub · PR #1187 in acme/checkout · approved by @sam-rivera and @lee-park");
  assert.equal(proofPostText(b), `${b.title}. Backed by GitHub, approved by @sam-rivera and @lee-park, on Brazework.`);
  // A private repo: how many, never who.
  assert.equal(proofBadge({ ...b, backing: { ...b.backing!, approvals: 3, approvers: [] } }), "Backed by GitHub · PR #1187 in acme/checkout · approved by 3 reviewers");
  // Nobody approved, or a card from before approvals were read: as it was.
  assert.equal(proofBadge({ ...b, backing: { ...b.backing!, approvals: 0, approvers: [] } }), "Backed by GitHub · PR #1187 in acme/checkout");
  assert.equal(proofBadge({ ...b, backing: { kind: "pull_request", repo: "acme/checkout", ref: "1187", url: "https://github.com/acme/checkout/pull/1187" } }), "Backed by GitHub · PR #1187 in acme/checkout");
  for (const t of [proofBadge(b), proofPostText(b)]) assert.doesNotMatch(t, /verified|signed|vouched/i);
});
