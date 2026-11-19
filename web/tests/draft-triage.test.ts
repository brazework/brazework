// Daily triage of drafts (supabase/daily-triage.sql): the heading counts right, each draft gets the
// buttons that fit it, Send to club picks a sensible club, and the daily reminder counts only what's
// new, names tools but never copies a draft, and isn't sent when nothing arrived. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDraftReminder, defaultClub, otherDraftLabel, reminderSources, triageActions, triageDone, triageHeading, waitingElsewhere } from "@/lib/draft-triage";

const CLUBS = [{ id: "rkt", name: "Rocketry Club" }, { id: "rob", name: "Robotics Society" }];

test("the heading counts what the tools noticed", () => {
  assert.equal(triageHeading(1), "Your tools noticed 1 thing");
  assert.equal(triageHeading(4), "Your tools noticed 4 things");
});

test("a milestone can be kept, sent to a club, sent for a signature or dismissed", () => {
  assert.deepEqual(triageActions("milestone", CLUBS).map((a) => a.label), ["Keep", "Send to club", "Ask to sign", "Dismiss"]);
});

test("a post is posted (or posted in a club), never 'signed'", () => {
  assert.deepEqual(triageActions("post", CLUBS).map((a) => a.action), ["keep", "club", "dismiss"]);
  assert.equal(triageActions("post", CLUBS)[0].label, "Post");
});

test("no clubs, no Send to club", () => {
  assert.deepEqual(triageActions("milestone", []).map((a) => a.action), ["keep", "sign", "dismiss"]);
  assert.deepEqual(triageActions("post", []).map((a) => a.action), ["keep", "dismiss"]);
});

test("Send to club starts on the club the tool picked, if the member is in it", () => {
  assert.equal(defaultClub("rob", CLUBS), "rob");
  assert.equal(defaultClub("gone", CLUBS), "rkt");
  assert.equal(defaultClub(null, CLUBS), "rkt");
  assert.equal(defaultClub("rkt", []), null);
});

test("each tap says what happened", () => {
  assert.equal(triageDone("keep", "milestone"), "Kept on your project. Ask someone to sign it when you're ready.");
  assert.equal(triageDone("club", "milestone", "Rocketry Club"), "Sent to Rocketry Club to verify.");
  assert.equal(triageDone("keep", "post"), "Posted.");
  assert.equal(triageDone("club", "post", "Robotics Society"), "Posted in Robotics Society.");
  assert.equal(triageDone("dismiss", "post"), "Dismissed.");
});

test("the reminder names the tools, with counts", () => {
  assert.equal(reminderSources([{ via: "GitHub Actions", n: 2 }]), "2 from GitHub Actions");
  assert.equal(reminderSources([{ via: "GitHub Actions", n: 2 }, { via: "Claude Code", n: 1 }, { via: "Cursor", n: 1 }]), "2 from GitHub Actions, 1 from Claude Code and 1 from Cursor");
  assert.equal(reminderSources([]), "");
});

test("the reminder: nothing new, no email", () => {
  assert.equal(buildDraftReminder({ first_name: "Ben", waiting: 4, fresh: 0, tools: [] }, "https://brazework.test"), null);
});

test("the reminder links to Today and Settings, and never copies a draft", () => {
  const e = buildDraftReminder({ first_name: "Ben", waiting: 5, fresh: 3, tools: [{ via: "GitHub Actions", n: 2 }, { via: "Claude <Code>", n: 1 }] }, "https://brazework.test")!;
  assert.equal(e.subject, "Your tools noticed 3 new things for your record");
  assert.match(e.text, /^Hi Ben,/);
  assert.match(e.text, /3 new drafts \(2 from GitHub Actions and 1 from Claude <Code>\), and 2 from before\./);
  assert.match(e.text, /https:\/\/brazework\.test\/feed#triage/);
  assert.match(e.text, /https:\/\/brazework\.test\/settings#email/);
  assert.doesNotMatch(e.html, /<Code>/, "tool names are escaped in HTML");
  assert.equal(buildDraftReminder({ first_name: "", waiting: 1, fresh: 1, tools: [{ via: "Zed", n: 1 }] }, "https://x.test")!.subject, "Your tools noticed 1 new thing for your record");
});

test("a project an assistant drafted is named on Today, so it's never hidden in Drafts", () => {
  assert.equal(waitingElsewhere(1, { kind: "project", title: "Brazework" }), "A new project: \u201cBrazework\u201d");
  assert.equal(waitingElsewhere(1, { kind: "rsvp", title: null }), "An RSVP");
  assert.equal(waitingElsewhere(3, { kind: "teammate", title: "  " }), "3 more in Drafts, newest a teammate to add");
  assert.equal(waitingElsewhere(0, null), "");
  assert.equal(otherDraftLabel("something-new"), "a draft");
  assert.ok(waitingElsewhere(1, { kind: "project", title: "x".repeat(200) }).length < 100, "a long title is cut");
});
