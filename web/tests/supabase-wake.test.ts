// Waking staging before its database steps (.github/scripts/supabase-wake.mjs, Linear FIX-83). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { decide } from "../../.github/scripts/supabase-wake.mjs";

test("a running project is used, whatever its organization pays", () => {
  assert.equal(decide({ status: "ACTIVE_HEALTHY", plan: "free" }), "ready");
  assert.equal(decide({ status: "ACTIVE_HEALTHY", plan: "pro" }), "ready");
});

test("a paused project is woken only in a free organization: waking one in a paid org costs money", () => {
  assert.equal(decide({ status: "INACTIVE", plan: "free" }), "wake");
  assert.equal(decide({ status: "INACTIVE", plan: "pro" }), "skip-paid");
  assert.equal(decide({ status: "INACTIVE", plan: "team" }), "skip-paid");
  assert.equal(decide({ status: "INACTIVE", plan: undefined }), "skip-paid");
});

test("a project on its way up (or down) is waited for", () => {
  for (const status of ["COMING_UP", "RESTORING", "PAUSING", "ACTIVE_UNHEALTHY"]) assert.equal(decide({ status, plan: "free" }), "wait");
});

test("anything else is a failure to look at, never treated as fine", () => {
  for (const status of ["RESTORE_FAILED", "REMOVED", "INIT_FAILED", "SOMETHING_NEW", undefined]) assert.equal(decide({ status, plan: "free" }), "fail");
});
