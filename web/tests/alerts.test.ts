// Email alerts (Linear FIX-18): one email says who sent what, links to the right place, offers the
// settings, never copies message text, and isn't sent when there's nothing new. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { alertSubject, buildAlert } from "@/lib/alerts";

const SITE = "https://forge.test";

test("nothing new sends nothing", () => {
  assert.equal(buildAlert("Josh", {}, SITE), null);
  assert.equal(buildAlert("Josh", { messages: null, requests: [], comments: null }, SITE), null);
});

test("one thing from one person reads as a sentence", () => {
  assert.equal(alertSubject({ messages: [{ from: "Ana Lee", n: 1 }] }), "Ana Lee sent you a message");
  assert.equal(alertSubject({ requests: ["Ben Ode"] }), "Ben Ode wants to connect");
  assert.equal(alertSubject({ comments: [{ from: "Cara Diaz", n: 3 }] }), "Cara Diaz left 3 comments on your posts");
});

test("several things are counted in the subject", () => {
  const items = { messages: [{ from: "Ana Lee", n: 2 }, { from: "Dev Rao", n: 1 }], requests: ["Ben Ode"], comments: [{ from: "Cara Diaz", n: 1 }] };
  assert.equal(alertSubject(items), "On Brazework: 3 new messages, 1 connection request, 1 new comment");
});

test("each line links to where you act on it, plus the settings", () => {
  const e = buildAlert("Josh", { messages: [{ from: "Ana Lee", n: 2 }], requests: ["Ben Ode"], comments: [{ from: "Cara Diaz", n: 1 }] }, SITE)!;
  assert.match(e.text, /^Hi Josh,/);
  assert.match(e.text, /Ana Lee sent you 2 messages \(Reply: https:\/\/forge\.test\/messages\)/);
  assert.match(e.text, /Ben Ode wants to connect \(Respond: https:\/\/forge\.test\/network\?tab=invitations\)/);
  assert.match(e.text, /Cara Diaz commented on your post \(See: https:\/\/forge\.test\/notifications\)/);
  assert.match(e.text, /https:\/\/forge\.test\/settings#email/);
  assert.match(e.html, /settings#email/);
});

test("names are escaped in HTML, and a missing name still reads", () => {
  const e = buildAlert("", { messages: [{ from: "<b>x</b>", n: 1 }], requests: ["  "] }, SITE)!;
  assert.ok(!e.html.includes("<b>x</b>"));
  assert.match(e.html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(e.text, /^Hi,/);
  assert.match(e.text, /Someone wants to connect/);
});
