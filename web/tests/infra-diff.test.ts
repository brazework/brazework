// Infrastructure as code (Linear FIX-82): the rules that decide what counts as drift between
// infra/desired.json and production. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { diff, splitList } from "../../infra/diff.mjs";

test("the same settings are no drift; a changed value is, with what the repo wants and what's live", () => {
  assert.deepEqual(diff({ a: 1, b: { c: "x" } }, { a: 1, b: { c: "x" } }), []);
  assert.deepEqual(diff({ rate: 100 }, { rate: 50 }), [{ path: "rate", want: 100, got: 50 }]);
  assert.deepEqual(diff({ auth: { site_url: "https://brazework.com" } }, { auth: { site_url: "https://old.vercel.app" } }),
    [{ path: "auth.site_url", want: "https://brazework.com", got: "https://old.vercel.app" }]);
});

test("only what the repo owns is compared: an extra live setting isn't drift", () => {
  assert.deepEqual(diff({ a: 1 }, { a: 1, somethingWeDontModel: true }), []);
});

test("a setting missing from production is drift", () => {
  assert.deepEqual(diff({ smtp_host: "smtp.resend.com" }, {}), [{ path: "smtp_host", want: "smtp.resend.com", got: undefined }]);
});

test("lists are sets: order doesn't matter; missing and extra items both count", () => {
  const rec = (name: string) => ({ type: "TXT", name, value: "v" });
  assert.deepEqual(diff([rec("a"), rec("b")], [rec("b"), rec("a")]), []);
  assert.deepEqual(diff([rec("a"), rec("b")], [rec("a")]), [{ path: "", want: rec("b"), got: "(missing)" }]);
  assert.deepEqual(diff([rec("a")], [rec("a"), rec("x")]), [{ path: "", want: "(not in the repo)", got: rec("x") }]);
});

test("numbers Supabase returns as strings match the repo's numbers", () => {
  assert.deepEqual(diff({ smtp_port: 465 }, { smtp_port: "465" }), []);
});

test("the redirect list is split from Supabase's comma-separated string", () => {
  assert.deepEqual(splitList("https://a/**, https://b/**,"), ["https://a/**", "https://b/**"]);
  assert.deepEqual(splitList(""), []);
});
