// The vouch email (lib/vouch-email.ts): who's asking, what for, the link, and nothing a name or title
// could inject. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVouchEmail } from "../src/lib/vouch-email";

test("the email says who asked, what for, and carries the link", () => {
  const e = buildVouchEmail({ member: "Ben Cho", title: "Static fire at 1.2 kN", project: "Liquid engine", relationship: "professor", link: "https://brazework.com/vouch/abc" });
  assert.equal(e.subject, "Ben Cho asked you to vouch for their work");
  assert.match(e.text, /listed you as a professor/);
  assert.match(e.text, /"Static fire at 1\.2 kN" \(Liquid engine\)/);
  assert.match(e.text, /https:\/\/brazework\.com\/vouch\/abc/);
  assert.match(e.html, /href="https:\/\/brazework\.com\/vouch\/abc"/);
  assert.match(e.text, /expires in 14 days/);
});

test("names and titles are escaped in the HTML", () => {
  const e = buildVouchEmail({ member: "<b>Eve</b>", title: `"><script>alert(1)</script>`, project: "", relationship: "mentor", link: "https://brazework.com/vouch/x" });
  assert.ok(!e.html.includes("<script>"), "no raw script tag");
  assert.ok(e.html.includes("&lt;b&gt;Eve&lt;/b&gt;"));
});

test("no name still reads well", () => {
  assert.equal(buildVouchEmail({ member: "", title: "T", project: "", relationship: "other", link: "https://x.test/v" }).subject, "A student asked you to vouch for their work");
});
