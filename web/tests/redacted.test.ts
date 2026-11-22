// Proof without revealing confidential work (supabase/redacted-proof.sql): the public line says who
// stood behind it in general terms, never a name, domain or club. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { redactedMonth, redactedSigner, redactedText, type Redacted } from "@/lib/redacted";

const r = (o: Partial<Redacted>): Redacted => ({ id: "m", line: "Shipped a payments migration", month: "2026-11", pro: false, signer: { kind: "vouch", role: "manager", org: "company" }, ...o });

test("a coworker at a verified company", () => {
  assert.equal(redactedText(r({})), "Shipped a payments migration · signed by a coworker at a verified company · Nov 2026");
});

test("a professor at a university, a club, and a pro sign-off", () => {
  assert.equal(redactedSigner(r({ signer: { kind: "vouch", role: "professor", org: "university" } })), "signed by a professor at a university");
  assert.equal(redactedSigner(r({ signer: { kind: "club" } })), "verified by a club's officers");
  assert.equal(redactedSigner(r({ signer: { kind: "club" }, pro: true })), "verified by a club's officers, and signed off by a professional at a verified company");
  assert.equal(redactedSigner(r({ signer: { kind: "vouch", role: "weird", org: "company" } })), "signed by someone who saw it at a verified company");
});

test("the month, or nothing", () => {
  assert.equal(redactedMonth("2026-01"), "Jan 2026");
  assert.equal(redactedMonth("nope"), "");
  assert.equal(redactedText(r({ month: "" })), "Shipped a payments migration · signed by a coworker at a verified company");
});

test("a work address at a company that isn't verified is never called verified", () => {
  const work = redactedSigner(r({ signer: { kind: "vouch", role: "manager", org: "work" } }));
  assert.equal(work, "signed by a coworker at a company (not verified)");
  assert.doesNotMatch(work, /a verified company/);
});

test("a personal address is said plainly, never called a company's (step 86)", () => {
  const personal = redactedSigner(r({ signer: { kind: "vouch", role: "mentor", org: "personal" } }));
  assert.equal(personal, "signed by a mentor (from a personal email)");
  assert.doesNotMatch(personal, /company|university/);
});
