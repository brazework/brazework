// The weekly digest says what Your week says, links back, offers the off switch, and isn't sent in
// a quiet week. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDigest } from "@/lib/digest";
import { buildWeek } from "@/lib/week";

const quiet = { clubPosts: 0, verifiedInClubs: [], myPending: 0, toVerify: null, quietProject: null, nextEvent: null, hasClub: true, hasProject: true };

test("a quiet week sends nothing", () => {
  assert.equal(buildDigest("Josh", buildWeek(quiet), "https://forge.test"), null);
});

test("waiting items lead the subject; links are absolute; the off switch is there", () => {
  const items = buildWeek({ ...quiet, toVerify: { clubId: "rkt", n: 2 }, clubPosts: 3 });
  const d = buildDigest("Ben", items, "https://forge.test")!;
  assert.equal(d.subject, "Your week on Forge: 1 thing waiting on you");
  assert.match(d.text, /2 milestones waiting for you to verify \(Review: https:\/\/forge\.test\/c\/rkt\/manage\?tab=verify\)/);
  assert.match(d.text, /3 new posts in your clubs this week/);
  assert.match(d.text, /Turn it off in Settings: https:\/\/forge\.test\/settings#email/);
  assert.match(d.html, /href="https:\/\/forge\.test\/c\/rkt\/manage\?tab=verify"/);
});

test("text from members is escaped in the HTML", () => {
  const items = buildWeek({ ...quiet, quietProject: { id: "p1", title: "<script>x</script>", days: 9 } });
  const d = buildDigest("Josh", items, "https://forge.test")!;
  assert.doesNotMatch(d.html, /<script>/);
  assert.match(d.html, /&lt;script&gt;/);
});
