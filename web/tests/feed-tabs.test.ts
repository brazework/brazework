// Today's feed shows two tabs (Your clubs, Everyone); the other feeds sit in a More menu and stay the
// separate feeds they are in the database. Old links (?tab=latest…) keep working. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { feedTabs } from "@/lib/feed-tabs";

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const labels = (xs: { label: string }[]) => xs.map((x) => x.label);

test("a chapter member: Your clubs is their chapter, and it's where Today opens", () => {
  const t = feedTabs("chapter", true);
  assert.deepEqual(ids(t.shown), ["chapter", "for-you"]);
  assert.deepEqual(labels(t.shown), ["Your clubs", "Everyone"]);
  assert.equal(t.active, "chapter");
  assert.deepEqual(labels(t.more), ["Latest", "Following", "All my clubs"]);
  assert.equal(t.moreLabel, "More");
});

test("no chapter: Your clubs is the clubs feed, and Today opens on Everyone", () => {
  const t = feedTabs("for-you", false);
  assert.deepEqual(ids(t.shown), ["communities", "for-you"]);
  assert.equal(t.active, "for-you");
  assert.deepEqual(labels(t.more), ["Latest", "Following"]);
});

test("no chapter, on the clubs feed: Your clubs is lit (its empty state says to join a club)", () => {
  assert.equal(feedTabs("communities", false).active, "communities");
});

test("a feed from the More menu: neither tab is lit and the menu says which feed it is", () => {
  const latest = feedTabs("latest", false);
  assert.equal(latest.active, "");
  assert.equal(latest.moreLabel, "Latest");
  assert.equal(feedTabs("following", true).moreLabel, "Following");
  const all = feedTabs("communities", true);
  assert.equal(all.active, "");
  assert.equal(all.moreLabel, "All my clubs");
});
