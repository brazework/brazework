// "Your week" says only what's true, puts what others are waiting on first, and offers one next
// step. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLoopSteps, buildWeek, weekGoal, type WeekInput } from "@/lib/week";

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

test("who looked: companies by name first, otherwise a count", () => {
  const named = buildWeek({ ...quiet, viewers: { total: 4, companies: ["Acme Aerospace", "Orbital Co"] } });
  assert.equal(named[0].text, "Acme Aerospace and 1 more company viewed your profile");
  assert.equal(named[0].href, "/dashboard");
  assert.equal(buildWeek({ ...quiet, viewers: { total: 1, companies: [] } })[0].text, "1 person viewed your profile this week");
  assert.deepEqual(buildWeek({ ...quiet, viewers: { total: 0, companies: [] } }), []);
});

test("the week's goal: others first, then what makes your work verifiable, then the streak", () => {
  const base = { ...quiet, hasMilestone: true };
  assert.equal(weekGoal({ ...base, toVerify: { clubId: "rkt", n: 2 } }, true).text, "Verify 2 milestones for your club");
  assert.equal(weekGoal({ ...base, hasClub: false }, false).id, "join");
  assert.equal(weekGoal({ ...base, hasProject: false }, false).id, "project");
  assert.equal(weekGoal({ ...base, hasMilestone: false }, false).id, "ask");
  assert.deepEqual(weekGoal(base, true), { id: "done", text: "You've shown your work this week", href: "/profile", action: "", done: true });
  assert.equal(weekGoal({ ...base, quietProject: { id: "p1", title: "Test stand", days: 9 } }, false).text, "Post an update on Test stand");
  assert.equal(weekGoal(base, false).href, "/feed#composer");
});

test("the build loop: done, now and next from real state, with one action each", () => {
  const base = { ...quiet, hasMilestone: true };
  const fresh = buildLoopSteps(base, { shownThisWeek: false, verified: 0, me: "u1" });
  assert.deepEqual(fresh.map((x) => x.state), ["now", "next", "next"]);
  assert.equal(fresh[0].line, "Share what you built this week");
  assert.equal(fresh[2].cta?.href, "/u/u1?view=visitor");
  const going = buildLoopSteps({ ...base, myPending: 1, viewers: { total: 3, companies: ["Acme Aerospace"] } }, { shownThisWeek: true, verified: 2, me: "u1" });
  assert.deepEqual(going.map((x) => x.state), ["done", "done", "done"]);
  assert.equal(going[1].line, "2 milestones verified by your club · 1 waiting");
  assert.equal(going[2].line, "Acme Aerospace viewed your profile");
  assert.equal(going[0].cta, null);
  const noClub = buildLoopSteps({ ...base, hasClub: false }, { shownThisWeek: true, verified: 0, me: "u1" });
  assert.deepEqual(noClub.map((x) => x.state), ["done", "now", "next"]);
  assert.equal(noClub[1].cta?.href, "/communities?tab=discover");
});
