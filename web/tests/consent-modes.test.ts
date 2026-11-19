// The consent page's choice (app/oauth/consent/modes.ts, supabase/mcp-oauth-post.sql): adding after a
// yes in chat is first and the default; a form that didn't offer the choice keeps drafting.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSENT_MODES, canPostFor } from "@/app/oauth/consent/modes";

test("approve in chat is the first choice, so the page checks it by default", () => {
  assert.equal(CONSENT_MODES[0].value, "chat");
  assert.deepEqual(CONSENT_MODES.map((m) => m.value), ["chat", "drafts"]);
});

test("posting only when the member's form chose it", () => {
  assert.equal(canPostFor("chat"), true);
  assert.equal(canPostFor("drafts"), false);
  assert.equal(canPostFor(null), false, "a page shown without the choice said drafts, so it drafts");
  assert.equal(canPostFor("post"), false);
});
