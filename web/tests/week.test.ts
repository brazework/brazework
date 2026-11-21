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

// The goal check-in (lib/week.ts goalWeekItem): progress on the path, the one next step, and how many
// verified companies looked this week, at the top of your week and in the weekly email.
test("the goal check-in comes first: progress, the next step from goalPath, and companies who looked", async () => {
  const { goalPath } = await import("@/lib/goals");
  const { buildDigest } = await import("@/lib/digest");
  const goal = { kind: "internship" as const, target: "power electronics", record: { projects: 2, signed: 2, waiting: 0, looked: 1 } };
  const items = buildWeek({ ...quiet, goal, viewers: { total: 3, companies: ["Volt Systems", "Acme"] } });
  assert.equal(items[0].id, "goal");
  assert.equal(items[0].tone, "todo");
  assert.equal(items[0].text, "2 of 3 signed toward your goal. 2 verified companies looked this week.", "short on Home, under the goal card");
  assert.match(items[0].email!, /^2 of 3 signed toward a summer internship in power electronics\. 2 verified companies looked this week\. Next: /);
  assert.ok(items[0].email!.endsWith(goalPath(goal, goal.record).next.text), "the next step is the app's own");
  assert.equal(items[0].action, goalPath(goal, goal.record).next.action);
  assert.equal(items[0].href, "/projects");
  const quietWeek = buildWeek({ ...quiet, goal, viewers: { total: 0, companies: [] } });
  assert.doesNotMatch(quietWeek[0].text, /looked this week/, "no company count when none looked");
  assert.equal(buildWeek(quiet).some((i) => i.id === "goal"), false, "no goal, no check-in");
  const mail = buildDigest("Ben", items, "https://brazework.com")!;
  assert.match(mail.text, /2 of 3 signed toward a summer internship in power electronics\. .*Next: /, "the weekly email carries the full line");
  assert.match(mail.html, /2 of 3 signed toward a summer internship in power electronics/);
});

// A working (professional) account in no club: there is nobody to join. Whoever saw the work signs it,
// so every nudge points at asking them (Linear FIX-224).
test("a working member with no club is asked to get work signed, never to join a club", () => {
  const solo = { ...quiet, hasClub: false, working: true };
  // No project yet: add one first, as for anyone.
  assert.equal(buildWeek({ ...solo, hasProject: false }).at(-1)?.id, "project");
  // A project, nothing asked yet: ask someone who saw it.
  const ask = buildWeek({ ...solo, hasMilestone: false }).at(-1)!;
  assert.deepEqual([ask.id, ask.text, ask.href, ask.action], ["ask", "Ask someone who saw your work to sign it", "/projects", "Ask"]);
  // Already asked: no nudge to join, and what's waiting isn't "for your club".
  assert.deepEqual(buildWeek({ ...solo, hasMilestone: true }), []);
  assert.equal(buildWeek({ ...solo, hasMilestone: true, myPending: 2 })[0].text, "2 milestones of yours waiting to be signed");
  for (const w of [solo, { ...solo, hasProject: false }, { ...solo, hasMilestone: true, myPending: 1 }])
    assert.ok(!buildWeek(w).some((i) => i.id === "join" || /club/i.test(i.text)), "no club wording");

  assert.equal(weekGoal({ ...solo, hasProject: false }, false).id, "project");
  assert.equal(weekGoal({ ...solo, hasMilestone: false }, false).text, "Ask someone who saw your work to sign it");
  assert.equal(weekGoal({ ...solo, hasMilestone: true }, false).id, "share");

  const steps = buildLoopSteps({ ...solo, hasMilestone: false }, { shownThisWeek: true, verified: 0, me: "u1" });
  const verify = steps.find((s) => s.id === "verify")!;
  assert.equal(verify.title, "Get it signed");
  assert.equal(verify.line, "Ask someone who saw your work to sign it");
  assert.deepEqual(verify.cta, { label: "Ask for a signature", href: "/projects" });
  assert.equal(buildLoopSteps({ ...solo, myPending: 1 }, { shownThisWeek: true, verified: 0, me: "u1" })[1].line, "1 milestone waiting to be signed");
  assert.equal(buildLoopSteps(solo, { shownThisWeek: true, verified: 3, me: "u1" })[1].line, "3 milestones signed");
});

test("a working member who is in a club, and a student with none, read as before", () => {
  // In a club: the club's wording, whatever the account type.
  assert.equal(weekGoal({ ...quiet, working: true, hasMilestone: false }, false).text, "Ask your club to verify your first milestone");
  assert.equal(buildWeek({ ...quiet, working: true, myPending: 1 })[0].text, "1 milestone of yours waiting for your club");
  assert.equal(buildLoopSteps({ ...quiet, working: true }, { shownThisWeek: true, verified: 0, me: "u1" })[1].title, "Verify");
  // A student with no club is still pointed at one.
  assert.equal(buildWeek({ ...quiet, hasClub: false, working: false }).at(-1)?.id, "join");
  assert.equal(weekGoal({ ...quiet, hasClub: false, working: false, hasMilestone: true }, false).id, "join");
});
