// Club setup for officers (lib/club-setup.ts): which invite link to hand out, and progress. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { inviteMessage, inviteUrl, reusableInvite, setupProgress, STARTER_RULES, type InviteRow } from "../src/lib/club-setup";

const now = Date.parse("2026-11-16T12:00:00Z");
const row = (o: Partial<InviteRow>): InviteRow => ({ code: "c", expires_at: null, max_uses: null, uses: 0, revoked: false, ...o });

test("hands out a working link instead of making another", () => {
  assert.equal(reusableInvite([row({ code: "a" })], now)?.code, "a");
  assert.equal(reusableInvite([], now), null);
});

test("never hands out a revoked, used-up or nearly expired link", () => {
  assert.equal(reusableInvite([row({ revoked: true })], now), null);
  assert.equal(reusableInvite([row({ max_uses: 10, uses: 10 })], now), null);
  assert.equal(reusableInvite([row({ expires_at: "2026-11-16T20:00:00Z" })], now), null, "dies tonight");
  assert.equal(reusableInvite([row({ expires_at: "2026-11-25T12:00:00Z" })], now)?.code, "c", "good for a week");
  assert.equal(reusableInvite([row({ code: "dead", revoked: true }), row({ code: "live", max_uses: 25, uses: 3 })], now)?.code, "live");
});

test("progress: done of total, the next step, complete only when everything is done", () => {
  const p = setupProgress([{ id: "about", done: true }, { id: "rules", done: false }, { id: "invite", done: false }]);
  assert.deepEqual([p.done, p.total, p.next?.id, p.complete], [1, 3, "rules", false]);
  assert.equal(setupProgress([{ id: "a", done: true }]).complete, true);
  assert.equal(setupProgress([]).complete, false, "no steps (features off) isn't 'complete'; the card just doesn't show");
});

test("the invite message carries the link, and the URL is clean", () => {
  assert.equal(inviteUrl("https://brazework.com/", "abc123"), "https://brazework.com/join/abc123");
  assert.match(inviteMessage("Rocketry Club", "https://brazework.com/join/abc123"), /Rocketry Club.*https:\/\/brazework\.com\/join\/abc123$/);
  assert.ok(STARTER_RULES.split("\n").length >= 5);
});
