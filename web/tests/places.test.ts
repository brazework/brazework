// The five places of the signed-in app (redesign stage 1): which place a path belongs to, and which
// tab row (if any) a page shows. The sidebar, the phone bar and the place tabs all read this list, so
// they can't disagree. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MENU_PAGES, PLACES, placeFor, placeTabsFor } from "@/lib/places";

test("five places, in order, on the same routes as before", () => {
  assert.deepEqual(PLACES.map((p) => p.label), ["Home", "Projects", "Clubs", "Record", "Chats"]);
  assert.deepEqual(PLACES.map((p) => p.id), ["home", "projects", "clubs", "record", "inbox"]);
  // Renamed, not moved: every link, bookmark and email keeps working.
  assert.deepEqual(PLACES.map((p) => p.href), ["/feed", "/projects", "/communities", "/profile", "/messages"]);
});

test("a path lights up exactly one place, by whole path segments", () => {
  assert.equal(placeFor("/projects/p1")?.id, "projects", "/projects must never light up Record via /pro");
  assert.equal(placeFor("/pro")?.id, "record");
  assert.equal(placeFor("/pro/queue")?.id, "record");
  assert.equal(placeFor("/c/abc/manage")?.id, "clubs");
  assert.equal(placeFor("/events/e1")?.id, "clubs");
  assert.equal(placeFor("/challenges")?.id, "clubs");
  assert.equal(placeFor("/chapters/new")?.id, "clubs");
  assert.equal(placeFor("/post/1")?.id, "home");
  assert.equal(placeFor("/notifications")?.id, "home");
  assert.equal(placeFor("/messages/g/1")?.id, "inbox");
  assert.equal(placeFor("/u/someone")?.id, "record");
  assert.equal(placeFor("/settings/tools")?.id, "record");
  assert.equal(placeFor("/copilot"), null, "Ember is not a place");
});

test("the tab row shows on a place's own pages, never on detail pages", () => {
  assert.deepEqual(tabs("/events"), { place: "clubs", active: "events" });
  assert.deepEqual(tabs("/communities"), { place: "clubs", active: "clubs" });
  assert.deepEqual(tabs("/network"), { place: "record", active: "connections" });
  assert.deepEqual(tabs("/dashboard"), { place: "record", active: "analytics" });
  assert.deepEqual(tabs("/feed"), { place: "home", active: "home" });
  assert.deepEqual(tabs("/saved"), { place: "home", active: "saved" });
  assert.equal(placeTabsFor("/events/e1"), null);
  assert.equal(placeTabsFor("/c/abc"), null);
  assert.equal(placeTabsFor("/projects"), null, "Projects has no tabs until stage 2");
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
