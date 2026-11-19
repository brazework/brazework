// What the log-in page remembers about the last sign-in on this device (lib/last-signin.ts).
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLastSignIn } from "../src/lib/last-signin";

test("a remembered method and email come back as saved", () => {
  assert.deepEqual(parseLastSignIn('{"method":"code","email":"dana@hartford.edu"}'), { method: "code", email: "dana@hartford.edu" });
  assert.deepEqual(parseLastSignIn('{"method":"google"}'), { method: "google" });
  assert.deepEqual(parseLastSignIn('{"method":"password","email":"pat@voltline.io"}'), { method: "password", email: "pat@voltline.io" });
});

test("anything else is forgotten, not trusted", () => {
  assert.equal(parseLastSignIn(null), null);
  assert.equal(parseLastSignIn("not json"), null);
  assert.equal(parseLastSignIn('{"method":"sms"}'), null, "unknown method");
  assert.equal(parseLastSignIn('{"method":"__proto__"}'), null);
  assert.deepEqual(parseLastSignIn('{"method":"github","email":"<script>"}'), { method: "github" }, "a malformed email is dropped");
  assert.deepEqual(parseLastSignIn(JSON.stringify({ method: "code", email: `${"a".repeat(260)}@x.io` })), { method: "code" }, "an over-long email is dropped");
});
