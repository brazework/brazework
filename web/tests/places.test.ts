// The five places of the signed-in app (redesign stage 1): which place a path belongs to, and which
// tab row (if any) a page shows. The sidebar, the phone bar and the place tabs all read this list, so
// they can't disagree. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MENU_PAGES, PLACES, placeFor, placeTabsFor } from "@/lib/places";

test("five places, in order", () => {
  assert.deepEqual(PLACES.map((p) => p.label), ["Today", "Build", "Club", "Proof", "Inbox"]);
});

test("a path lights up exactly one place, by whole path segments", () => {
  assert.equal(placeFor("/projects/p1")?.id, "build", "/projects must never light up Proof via /pro");
  assert.equal(placeFor("/pro")?.id, "proof");
  assert.equal(placeFor("/pro/queue")?.id, "proof");
  assert.equal(placeFor("/c/abc/manage")?.id, "club");
  assert.equal(placeFor("/events/e1")?.id, "club");
  assert.equal(placeFor("/challenges")?.id, "club");
  assert.equal(placeFor("/chapters/new")?.id, "club");
  assert.equal(placeFor("/post/1")?.id, "today");
  assert.equal(placeFor("/notifications")?.id, "today");
  assert.equal(placeFor("/messages/g/1")?.id, "inbox");
  assert.equal(placeFor("/u/someone")?.id, "proof");
  assert.equal(placeFor("/settings/tools")?.id, "proof");
  assert.equal(placeFor("/copilot"), null, "Ember is not a place");
});

test("the tab row shows on a place's own pages, never on detail pages", () => {
  assert.deepEqual(tabs("/events"), { place: "club", active: "events" });
  assert.deepEqual(tabs("/communities"), { place: "club", active: "clubs" });
  assert.deepEqual(tabs("/network"), { place: "proof", active: "connections" });
  assert.deepEqual(tabs("/dashboard"), { place: "proof", active: "analytics" });
  assert.deepEqual(tabs("/feed"), { place: "today", active: "today" });
  assert.deepEqual(tabs("/saved"), { place: "today", active: "saved" });
  assert.equal(placeTabsFor("/events/e1"), null);
  assert.equal(placeTabsFor("/c/abc"), null);
  assert.equal(placeTabsFor("/projects"), null, "Build has no tabs until stage 2");
  assert.equal(placeTabsFor("/messages"), null);
  assert.equal(placeTabsFor("/u/someone"), null, "the profile page decides for itself (own profile only)");
});

test("every page the More drawer used to list still has a home", () => {
  assert.equal(MENU_PAGES.length, 8);
  for (const m of MENU_PAGES) assert.ok(placeFor(m.href), `${m.href} belongs to a place`);
});

function tabs(path: string) {
  const t = placeTabsFor(path);
  return t && { place: t.place.id, active: t.active };
}
