// "Your week" says only what's true, puts what others are waiting on first, and offers one next
// step. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWeek, type WeekInput } from "@/lib/week";

const quiet: WeekInput = { clubPosts: 0, verifiedInClubs: [], myPending: 0, toVerify: null, quietProject: null, nextEvent: null, hasClub: true, hasProject: true };

test("a quiet week with nothing to do says nothing", () => {
  assert.deepEqual(buildWeek(quiet), []);
});

test("verifying for others comes first, then your event, then news", () => {
  const ids = buildWeek({ ...quiet, clubPosts: 4, myPending: 1, toVerify: { clubId: "rkt", n: 3 }, nextEvent: { id: "e1", title: "GBM", days: 1 }, verifiedInClubs: [{ club: "Rocketry Club", n: 2 }] }).map((i) => i.id);
  assert.deepEqual(ids, ["verify", "event", "pending", "verified-Rocketry Club", "posts"]);
});

test("wording is exact: plurals and when", () => {
  const w = buildWeek({ ...quiet, toVerify: { clubId: "rkt", n: 1 }, nextEvent: { id: "e1", title: "GBM", days: 0 }, clubPosts: 1 });
  assert.equal(w[0].text, "1 milestone waiting for you to verify");
  assert.equal(w[0].href, "/c/rkt/manage?tab=verify");
  assert.equal(w[1].text, "You're going to GBM today");
  assert.equal(w[2].text, "1 new post in your clubs this week");
});

test("one next step: club first, then a project, then a quiet project", () => {
  assert.equal(buildWeek({ ...quiet, hasClub: false }).at(-1)?.id, "join");
  assert.equal(buildWeek({ ...quiet, hasProject: false }).at(-1)?.id, "project");
  const q = buildWeek({ ...quiet, quietProject: { id: "p1", title: "Test stand", days: 9 } }).at(-1)!;
  assert.equal(q.text, "No update on Test stand in 9 days");
  assert.equal(q.href, "/feed?project=p1#composer");
  assert.deepEqual(buildWeek({ ...quiet, quietProject: { id: "p1", title: "Test stand", days: 3 } }), [], "a recent update isn't nagged");
});
