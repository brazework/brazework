// The five places of the signed-in app (redesign stage 1): which place a path belongs to, and which
// tab row (if any) a page shows. The sidebar, the phone bar and the place tabs all read this list, so
// they can't disagree. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MENU_PAGES, PLACES, phoneTabsFor, placeFor, placeTabsFor, placesFor } from "@/lib/places";

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
  assert.equal(placeFor("/copilot"), null, "Torch is not a place");
});

test("the tab row shows on a place's own pages, never on detail pages", () => {
  assert.deepEqual(tabs("/events"), { place: "clubs", active: "events" });
  assert.deepEqual(tabs("/communities"), { place: "clubs", active: "clubs" });
  assert.equal(placeTabsFor("/network"), null, "Connections is off the navigation (2026-11-26)");
  assert.deepEqual(tabs("/school"), { place: "clubs", active: "school" });
  assert.deepEqual(tabs("/dashboard"), { place: "record", active: "analytics" });
  assert.deepEqual(tabs("/feed"), { place: "home", active: "home" });
  assert.equal(placeFor("/saved")?.id, "home", "Saved still answers old links, inside Home");
  assert.equal(placeTabsFor("/events/e1"), null);
  assert.equal(placeTabsFor("/c/abc"), null);
  assert.equal(placeTabsFor("/projects"), null, "Projects has no tabs until stage 2");
  assert.equal(placeTabsFor("/messages"), null);
  assert.equal(placeTabsFor("/u/someone"), null, "the profile page decides for itself (own profile only)");
});

test("the phone menu lists only what the realigned app needs, each inside a place", () => {
  assert.deepEqual(MENU_PAGES.map((m) => m.href), ["/notifications", "/school", "/events", "/dashboard", "/settings"]);
  // Off the navigation since 2026-11-26: no tab or menu points at them.
  const linked = [...PLACES.flatMap((p) => p.tabs.map((t) => t.href)), ...MENU_PAGES.map((m) => m.href)];
  for (const gone of ["/challenges", "/saved", "/network", "/pro"]) assert.ok(!linked.includes(gone), gone);
  for (const m of MENU_PAGES) assert.ok(placeFor(m.href), `${m.href} belongs to a place`);
});

function tabs(path: string) {
  const t = placeTabsFor(path);
  return t && { place: t.place.id, active: t.active };
}

test("at a school, School is a place right after Home; on a phone it takes Chats' slot", () => {
  assert.deepEqual(placesFor(false), PLACES, "everyone else keeps the five");
  assert.deepEqual(placesFor(true).map((p) => p.label), ["Home", "School", "Projects", "Clubs", "Record", "Chats"]);
  assert.deepEqual(phoneTabsFor(true).map((p) => p.label), ["Home", "School", "Projects", "Clubs", "Record"]);
  assert.deepEqual(phoneTabsFor(false).map((p) => p.label), ["Home", "Projects", "Clubs", "Record", "Chats"]);
  // /school lights School, not Clubs, and Clubs no longer carries a "Your school" tab.
  assert.equal(placeFor("/school", placesFor(true))?.id, "school");
  assert.ok(!placesFor(true).find((p) => p.id === "clubs")!.tabs.some((t) => t.id === "school"));
  assert.equal(placeFor("/school")?.id, "clubs", "without School, /school stays under Clubs");
});
