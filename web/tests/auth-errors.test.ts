// A busy or unreachable auth server must never look like "signed out". Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { isTemporaryAuthError } from "@/lib/supabase/auth-errors";

test("network failures, 5xx and rate limits are temporary", () => {
  assert.equal(isTemporaryAuthError({ name: "AuthRetryableFetchError", status: 0 }), true);
  assert.equal(isTemporaryAuthError({ name: "AuthApiError", status: 500 }), true);
  assert.equal(isTemporaryAuthError({ name: "AuthApiError", status: 503 }), true);
  assert.equal(isTemporaryAuthError({ name: "AuthApiError", status: 429 }), true);
});

test("a missing or invalid session really is signed out", () => {
  assert.equal(isTemporaryAuthError(null), false);
  assert.equal(isTemporaryAuthError(undefined), false);
  assert.equal(isTemporaryAuthError({ name: "AuthSessionMissingError", status: 400 }), false);
  assert.equal(isTemporaryAuthError({ name: "AuthApiError", status: 401 }), false);
  assert.equal(isTemporaryAuthError({ name: "AuthApiError", status: 403 }), false);
  assert.equal(isTemporaryAuthError({ name: "AuthInvalidJwtError", status: 400 }), false);
});
