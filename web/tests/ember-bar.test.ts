// The Ask Torch bar (components/ember/ask-bar.tsx): which page it's on, when "/" jumps to it, and the
// words on an approve card in the page. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { copilotRequest } from "@/lib/copilot-request";
import { ASK_PLACEHOLDER, BAR_TURNS, askShortcut, barHistory, cardLabels, cardSummary, pageContext, pickedFrom, type BarTurn } from "@/lib/ember-bar";
import { threadMessages, type CardOutcome } from "@/lib/ember-thread";

test("the bar knows the project, club or event it's on, from the path", () => {
  assert.deepEqual(pageContext("/projects/abc"), { kind: "project", id: "abc" });
  assert.deepEqual(pageContext("/projects/abc/reel"), { kind: "project", id: "abc" });
  assert.deepEqual(pageContext("/c/rkt"), { kind: "club", id: "rkt" });
  assert.deepEqual(pageContext("/c/rkt/manage"), { kind: "club", id: "rkt" });
  assert.deepEqual(pageContext("/events/e1?x=1"), { kind: "event", id: "e1" });
  assert.deepEqual(pageContext("/events/e1#chat"), { kind: "event", id: "e1" });
});

test("pages that aren't about one thing have no context", () => {
  assert.equal(pageContext("/projects"), null);
  assert.equal(pageContext("/feed"), null);
  assert.equal(pageContext("/communities"), null);
  assert.equal(pageContext("/events/new"), null);
  assert.equal(pageContext("/u/someone"), null, "a person isn't a page Torch drafts into");
  assert.equal(pageContext("/projects/a%20b"), null, "odd ids never reach the server");
  assert.equal(pageContext(`/projects/${"x".repeat(65)}`), null);
});

test("/ jumps to the bar only when you're not typing", () => {
  const key = (target: { tagName?: string; isContentEditable?: boolean } | null, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) =>
    askShortcut({ key: "/", metaKey: false, ctrlKey: false, altKey: false, target, ...mods });
  assert.equal(key({ tagName: "BODY" }), true);
  assert.equal(key({ tagName: "A" }), true);
  assert.equal(key(null), true);
  assert.equal(key({ tagName: "INPUT" }), false);
  assert.equal(key({ tagName: "TEXTAREA" }), false, "a slash in the composer stays a slash");
  assert.equal(key({ tagName: "SELECT" }), false);
  assert.equal(key({ tagName: "DIV", isContentEditable: true }), false);
  assert.equal(key({ tagName: "BODY" }, { metaKey: true }), false);
  assert.equal(askShortcut({ key: "k", metaKey: false, ctrlKey: false, altKey: false, target: { tagName: "BODY" } }), false);
});

test("a card in the page says what it does; elsewhere it's unchanged", () => {
  assert.deepEqual(cardLabels("milestone", true), { confirm: "Log and send to club", edit: "Edit", dismiss: "Not now" });
  assert.deepEqual(cardLabels("post", true), { confirm: "Confirm", edit: "Edit", dismiss: "Not now" });
  assert.deepEqual(cardLabels("milestone", false), { confirm: "Confirm", edit: null, dismiss: "Dismiss" });
  // Asking a person to sign sends an email, so the button says so wherever the card is.
  assert.deepEqual(cardLabels("signature", false), { confirm: "Ask them to sign", edit: null, dismiss: "Dismiss" });
  assert.deepEqual(cardLabels("signature", true), { confirm: "Ask them to sign", edit: "Edit", dismiss: "Not now" });
  assert.equal(ASK_PLACEHOLDER, "Ask Torch, or tell it what you did…");
});

test("the request carries the page, and refuses an id that isn't one", () => {
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "Got the PID loop stable", page: { kind: "project", id: "p1" } }).success, true);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "x", page: { kind: "project", id: "bad id" } }).success, false);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "x", page: { kind: "person", id: "u1" } }).success, false);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "x" }).success, true, "the page is optional");
});

test("a card in the page is a line or two until you press Edit", () => {
  const m = cardSummary({ id: "1", kind: "milestone", project_id: "p1", project_title: "Thrust stand", club_id: "rkt", club_name: "Rocketry Club", title: "PID loop holds within 2%", evidence: "https://github.com/ben/stand/pull/12", detail: "", achieved_on: "2026-11-19" });
  assert.deepEqual(m, { title: "PID loop holds within 2%", lines: ["On Thrust stand, for Rocketry Club to sign"], link: "https://github.com/ben/stand/pull/12" });
  const sig = { id: "5", kind: "signature" as const, milestone_id: "", project_id: "p1", project_title: "Checkout", title: "p95 down to 310 ms", evidence: "https://github.com/acme/checkout/pull/1187", detail: "", achieved_on: "2026-11-20", relationship: "manager" };
  assert.deepEqual(cardSummary({ ...sig, email: "sam@northwind.example" }), { title: "p95 down to 310 ms", lines: ["On Checkout, for sam@northwind.example to sign"], link: "https://github.com/acme/checkout/pull/1187" });
  assert.equal(cardSummary({ ...sig, email: "" }), null, "with no address yet, the card opens with its fields");
  const long = cardSummary({ id: "2", kind: "post", body: "x".repeat(400), postKind: "update", tags: ["robotics"] });
  assert.ok(long && long.title.length <= 160 && long.title.endsWith("…"));
  assert.deepEqual(long?.lines, ["#robotics"]);
  assert.equal(cardSummary({ id: "3", kind: "join", club_id: "rkt", club_name: "Rocketry Club", privacy: "public" }), null, "short cards show as they are");
  const edit = cardSummary({ id: "4", kind: "project_edit", project_id: "p1", project_title: "Thrust stand", summary: "New", details: "More", before: { summary: "", details: "", link: "", specs: [] } });
  assert.deepEqual(edit?.lines, ["summary, write-up"]);
});

test("the goal card says what confirming does", () => {
  assert.equal(cardLabels("goal", true).confirm, "Set this goal");
  assert.equal(cardLabels("goal", false).confirm, "Set this goal");
  const s = cardSummary({ id: "g1", kind: "goal", goal_kind: "job", target: "product design", title: "your next full-time role in product design", why: "You said you want to move into design." });
  assert.equal(s?.title, "Work toward your next full-time role in product design");
  assert.deepEqual(s?.lines, ["You said you want to move into design."]);
});


// ---------- The bar keeps its thread (docs/superpowers/specs/2026-11-26-ember-follow-through-design.md) ----------
const confirmed: CardOutcome = { kind: "project", label: "Rover", state: "confirmed" };
const turn = (q: string, text: string, cards: CardOutcome[] = []): BarTurn => ({ q, text, cards });

test("a follow-up in the bar goes to Torch with the exchange above it, oldest first", () => {
  const h = barHistory([turn("Add my rover", "It's on the card.", [confirmed]), turn("And a post?", "Drafted.")]);
  assert.deepEqual(h, [
    { role: "user", content: "Add my rover" },
    { role: "assistant", content: "It's on the card.", cards: [confirmed] },
    { role: "user", content: "And a post?" },
    { role: "assistant", content: "Drafted." },
  ]);
  // And Torch reads what happened to the card with the next thing the member says.
  assert.match(threadMessages(h.slice(0, 2), "now the milestone").at(-1)!.content, /a project "Rover": confirmed/);
});

test("an exchange that got no answer is left out whole, so turns still alternate", () => {
  const h = barHistory([turn("first", "Answer one."), turn("this one failed", ""), turn("third", "Answer three.")]);
  assert.deepEqual(h.map((m) => m.role), ["user", "assistant", "user", "assistant"]);
  assert.deepEqual(h.map((m) => m.content), ["first", "Answer one.", "third", "Answer three."]);
  assert.deepEqual(barHistory([]), []);
});

test("the bar sends back its newest turns, within what the request allows", () => {
  const many = Array.from({ length: 9 }, (_, i) => turn(`q${i}`, `a${i}`));
  const h = barHistory(many);
  assert.equal(h.length, BAR_TURNS * 2);
  assert.equal(h[0].content, "q3", "the oldest are dropped first");
  assert.equal(h.at(-1)!.content, "a8");
  const long = barHistory([turn("q", "x".repeat(9000))]);
  assert.ok(copilotRequest.safeParse({ task: "ask", input: "next", history: [...h] }).success);
  assert.ok(copilotRequest.safeParse({ task: "ask", input: "next", history: long }).success, "a very long answer is cut to fit");
});

test("the bar's history says which offered answer was tapped", () => {
  const offered = { options: ["Rocketry Club", "A person who saw it"] };
  assert.deepEqual(pickedFrom(offered, "Rocketry Club"), { ...offered, picked: "Rocketry Club" });
  assert.deepEqual(pickedFrom(offered, "something they typed"), offered, "typed, not tapped");
  assert.deepEqual(pickedFrom(offered, undefined), offered);
  assert.equal(pickedFrom(undefined, "Rocketry Club"), undefined);
  const h = barHistory([{ q: "I got the PID loop stable", text: "Who saw it?", cards: [], choice: pickedFrom(offered, "Rocketry Club") }]);
  assert.deepEqual(h[1], { role: "assistant", content: "Who saw it?", choice: { ...offered, picked: "Rocketry Club" } });
  assert.match(threadMessages(h, "Rocketry Club").at(-1)!.content, /They tapped "Rocketry Club"/);
});
