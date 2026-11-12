// The sidebar's "you are here": whole path segments only (redesign 2026-11 found "Pro reviews" lit up on
// /projects/p1, because "/projects" starts with "/pro"). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { onPage } from "@/lib/nav-match";

test("a page and the pages under it match; a longer word that starts the same doesn't", () => {
  assert.equal(onPage("/pro", "/pro"), true);
  assert.equal(onPage("/pro/queue", "/pro"), true);
  assert.equal(onPage("/projects/p1", "/pro"), false, "the bug the redesign screenshots caught");
  assert.equal(onPage("/projects", "/projects"), true);
  assert.equal(onPage("/settings/tools", "/settings"), true);
  assert.equal(onPage("/saved", "/settings"), false);
  assert.equal(onPage("/events", "/events/"), true, "a trailing slash in the link doesn't matter");
});
