// Signers' tools (supabase/signer-tools.sql): the one reminder email, and the history of what a signer
// signed, grouped by person for a recommendation letter. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByMember, letterLine, signedAs, type Signature } from "@/lib/signatures";
import { buildVouchReminder } from "@/lib/vouch-email";

const sig = (o: Partial<Signature>): Signature => ({
  kind: "vouch", milestone: "m", at: "2026-11-03T15:00:00Z", role: "professor", member: { id: "ben", first: "Ben", last: "Cho" },
  title: "Static fire at 1.2 kN", project: "Liquid engine", private: false, status: "verified", wrote: "I watched it.", how: "Advisor", ...o,
});

test("the reminder says it's the only one, carries the link, and escapes names", () => {
  const e = buildVouchReminder({ member: "Ben Cho", title: "Static fire", project: "Liquid engine", relationship: "pi", link: "https://brazework.com/vouch/r", expiresAt: "2026-11-30T12:00:00Z" });
  assert.equal(e.subject, "Reminder: Ben Cho asked you to vouch for their work");
  assert.match(e.text, /as their lab's PI who saw it/);
  assert.match(e.text, /This is the only reminder\. The ask closes on November 30\./);
  assert.match(e.text, /answer them all from the same page/);
  assert.match(e.html, /href="https:\/\/brazework\.com\/vouch\/r"/);
  const bad = buildVouchReminder({ member: "<b>x</b>", title: "<script>", project: "", relationship: "mentor", link: "https://x.test/v", expiresAt: "2026-11-30T12:00:00Z" });
  assert.ok(!bad.html.includes("<script>") && !bad.html.includes("<b>x</b>"));
});

test("how you signed, in words", () => {
  assert.equal(signedAs(sig({})), "As a professor");
  assert.equal(signedAs(sig({ role: "pi" })), "As their lab's PI");
  assert.equal(signedAs(sig({ kind: "club", role: "admin", club: "Rocketry Club" })), "As a club officer of Rocketry Club");
  assert.equal(signedAs(sig({ kind: "pro", role: "Senior Engineer", club: "Acme Aerospace" })), "As Senior Engineer at Acme Aerospace");
});

test("grouped by person, newest first", () => {
  const g = groupByMember([
    sig({ milestone: "a", at: "2026-10-01T00:00:00Z" }),
    sig({ milestone: "b", at: "2026-11-10T00:00:00Z", member: { id: "ana", first: "Ana", last: "Lee" } }),
    sig({ milestone: "c", at: "2026-11-01T00:00:00Z" }),
  ]);
  assert.deepEqual(g.map((x) => x.name), ["Ana Lee", "Ben Cho"]);
  assert.deepEqual(g[1].items.map((x) => x.milestone), ["c", "a"]);
});

test("a line for a letter, never a private title", () => {
  assert.equal(letterLine(sig({})), "On Nov 3, 2026, I signed: Static fire at 1.2 kN (Liquid engine).");
  assert.equal(letterLine(sig({ private: true, title: "", project: "" })), "On Nov 3, 2026, I signed work they've since made private.");
});
