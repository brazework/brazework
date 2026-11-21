import assert from "node:assert/strict";
import test from "node:test";
import { signatureRequest } from "../src/lib/signature-request";

const m = { project_id: "p1", title: "Measured lift on 3 fin shapes", evidence: "https://youtu.be/abc", achieved_on: "2026-11-20" };
const issue = (body: unknown) => { const r = signatureRequest.safeParse(body); return r.success ? "" : r.error.issues[0]?.message; };

test("an ask is about one milestone: an open one of yours, or a new one", () => {
  assert.equal(issue({ email: "dana@acme.com", relationship: "manager", milestone_id: "m1" }), "");
  assert.equal(issue({ email: "dana@acme.com", relationship: "manager", milestone: m }), "");
  assert.equal(issue({ email: "dana@acme.com", relationship: "manager" }), "Say which milestone to ask about.");
  assert.equal(issue({ email: "dana@acme.com", relationship: "manager", milestone_id: "m1", milestone: m }), "Say which milestone to ask about.");
});

test("no evidence, no request, and only https links", () => {
  assert.equal(issue({ email: "dana@acme.com", relationship: "mentor", milestone: { ...m, evidence: "" } }), "Add evidence: a link to a photo, video, file or commit.");
  assert.equal(issue({ email: "dana@acme.com", relationship: "mentor", milestone: { ...m, evidence: "http://x.com/a" } }), "Evidence has to be a secure web link (https://…).");
});

test("who and how they know the work, in the web's words", () => {
  assert.equal(issue({ email: "nope", relationship: "manager", milestone_id: "m1" }), "Enter their email address.");
  assert.equal(issue({ email: "dana@acme.com", relationship: "boss", milestone_id: "m1" }), "Pick how they know your work.");
  const r = signatureRequest.parse({ email: " Dana@Acme.com ", relationship: "professor", milestone: m });
  assert.equal(r.email, "dana@acme.com");
  assert.equal(r.milestone?.show_on_profile, true);
  assert.equal(r.milestone?.detail, "");
});
