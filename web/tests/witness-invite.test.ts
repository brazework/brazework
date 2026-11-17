// Witness invitations (lib/witness-invite.ts, Linear FIX-129): the one email someone who vouched by
// email gets when the result they vouched for is shared, and how the card credits a witness.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProofSharedEmail, witnessCredit } from "@/lib/witness-invite";

test("the email names who shared what, links the card, and invites them to start a record", () => {
  const e = buildProofSharedEmail({ to: "dana@voltline.com", member: "Maya Patel", title: "Cut the cycle from 9.4 to 7.1 seconds", cardUrl: "https://brazework.com/p/abc", signupUrl: "https://brazework.com/signup" });
  assert.equal(e.to, "dana@voltline.com");
  assert.equal(e.subject, "Maya Patel shared the work you vouched for");
  assert.ok(e.text.includes("https://brazework.com/p/abc") && e.text.includes("https://brazework.com/signup"));
  assert.ok(e.text.includes("Cut the cycle from 9.4 to 7.1 seconds"));
  assert.ok(/won't email you about it again/.test(e.text), "it says it's a one-off");
  assert.ok(e.html.includes('href="https://brazework.com/p/abc"'));
});

test("names and titles are escaped in the HTML", () => {
  const e = buildProofSharedEmail({ to: "a@b.co", member: "<b>Eve</b>", title: "x & y", cardUrl: "https://brazework.com/p/a", signupUrl: "https://brazework.com/signup" });
  assert.ok(!e.html.includes("<b>Eve</b>") && e.html.includes("&lt;b&gt;Eve&lt;/b&gt;") && e.html.includes("x &amp; y"));
});

test("a witness's credit reads naturally, and says nothing for a first signature", () => {
  assert.equal(witnessCredit(0), "");
  assert.equal(witnessCredit(1), "");
  assert.equal(witnessCredit(2), "Has signed 2 results on Brazework");
  assert.equal(witnessCredit(41), "Has signed 41 results on Brazework");
});
