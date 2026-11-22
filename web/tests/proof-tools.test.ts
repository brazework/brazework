// The "Add proof" picker's sources and the link check (lib/proof-tools.ts, lib/proof-check.ts; Linear FIX-235). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { TOPICS } from "@/lib/forge";
import { proofSource } from "@/lib/proof-source";
import { cleanLink, evidenceItem, evidenceLinks, PROOF_TOOLS, toolForSource, toolsForField } from "@/lib/proof-tools";
import { checkPlan, cleanTitle, readAnswer } from "@/lib/proof-check";

test("every field a member can pick shows six of its own tools, and the rest are one tap away", () => {
  for (const t of TOPICS) {
    const { first, more } = toolsForField(t.name);
    assert.equal(first.length, 6, t.name);
    assert.equal(first.length + more.length, PROOF_TOOLS.length, t.name);
  }
  assert.equal(toolsForField(null).first.length, 6);
  assert.equal(toolsForField("Not a field").first[0].id, "drive");
});

test("GitHub isn't first outside software, and each field leads with its own tool", () => {
  assert.equal(toolsForField("Engineering").first[0].name, "Onshape");
  assert.equal(toolsForField("Design & Arts").first[0].name, "Figma");
  assert.equal(toolsForField("Media & Communication").first[0].name, "YouTube");
  assert.equal(toolsForField("Computer Science").first[0].name, "GitHub");
  const notGithubFirst = TOPICS.filter((t) => toolsForField(t.name).first[0].id !== "github").length;
  assert.ok(notGithubFirst >= 12, `${notGithubFirst}`);
});

test("each tool's example is recognised as that tool, and says how to share it", () => {
  for (const t of PROOF_TOOLS) {
    assert.ok(t.share.length > 10, t.id);
    if (t.example.includes("…")) continue;
    const src = proofSource(t.example);
    assert.ok(src, t.id);
    assert.equal(toolForSource(src!.tool)?.id, t.id, `${t.id}: ${src!.tool}`);
  }
});

test("a pasted link is cleaned: https added or upgraded, junk refused", () => {
  assert.equal(cleanLink("  docs.google.com/document/d/abc  "), "https://docs.google.com/document/d/abc");
  assert.equal(cleanLink("http://github.com/a/b"), "https://github.com/a/b");
  assert.equal(cleanLink("not a link"), "");
  assert.equal(cleanLink("javascript:alert(1)"), "");
  assert.equal(cleanLink("https://user:pw@github.com/a/b"), "");
  assert.equal(cleanLink("https://localhost/x"), "");
  assert.equal(cleanLink("https://a.b"), "");
  assert.equal(cleanLink(`https://x.com/${"a".repeat(300)}`), "");
});

test("a form's links: cards then the box, cleaned, no repeats, eight at most", () => {
  const cards = JSON.stringify(["https://github.com/a/b/pull/1", "figma.com/design/x", "https://github.com/a/b/pull/1"]);
  assert.deepEqual(evidenceLinks("https://youtu.be/abc12345", cards), ["https://github.com/a/b/pull/1", "https://figma.com/design/x", "https://youtu.be/abc12345"]);
  assert.deepEqual(evidenceLinks("https://github.com/a/b", ""), ["https://github.com/a/b"]);
  assert.deepEqual(evidenceLinks("", "not json"), []);
  assert.deepEqual(evidenceLinks("", JSON.stringify([1, null, { url: "x" }])), []);
  const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => `https://example.com/proof/${i}`));
  assert.equal(evidenceLinks("", many).length, 8);
});

test("links beyond the first are saved as the database expects: commits as commits", () => {
  assert.deepEqual(evidenceItem("https://github.com/a/b/commit/3f2a9c1"), { type: "commit", url: "https://github.com/a/b/commit/3f2a9c1" });
  assert.deepEqual(evidenceItem("https://github.com/a/b/pull/3"), { type: "link", url: "https://github.com/a/b/pull/3" });
});

test("the check asks only known hosts, over https, and only on the known host", () => {
  assert.equal(checkPlan("https://youtu.be/abc")?.kind, "oembed");
  assert.match(checkPlan("https://www.youtube.com/watch?v=abc")!.url, /^https:\/\/www\.youtube\.com\/oembed\?/);
  assert.equal(checkPlan("https://docs.google.com/document/d/x/edit")?.url, "https://docs.google.com/document/d/x/edit");
  assert.equal(checkPlan("https://www.github.com/a/b")?.url, "https://github.com/a/b");
  for (const bad of ["https://example.com/x", "http://github.com/a/b", "https://github.com:8443/a", "https://u:p@github.com/a", "https://github.com.evil.io/a", "https://169.254.169.254/latest", "https://localhost/x", "not a url"]) {
    assert.equal(checkPlan(bad), null, bad);
  }
});

test("reading the answer: closed when the tool asks a stranger to sign in or says not found", () => {
  assert.deepEqual(readAnswer("page", 302, "https://accounts.google.com/ServiceLogin?continue=…", ""), { closed: true });
  assert.deepEqual(readAnswer("page", 404, null, ""), { closed: true });
  assert.deepEqual(readAnswer("oembed", 401, null, ""), { closed: true });
  assert.deepEqual(readAnswer("page", 302, "https://docs.google.com/document/d/x/edit", ""), {});
  assert.deepEqual(readAnswer("page", 500, null, ""), {});
  assert.deepEqual(readAnswer("page", 200, null, '<form action="https://accounts.google.com/signin">'), { closed: true });
});

test("reading the answer: the real title, without the tool's name around it", () => {
  assert.deepEqual(readAnswer("page", 200, null, "<html><title>Wind tunnel report - Google Docs</title>"), { title: "Wind tunnel report" });
  assert.deepEqual(readAnswer("page", 200, null, '<meta property="og:title" content="Add gimbal mount &amp; tests by eli · Pull Request #12 · eli/rig"><title>x</title>'), { title: "Add gimbal mount & tests by eli" });
  assert.deepEqual(readAnswer("oembed", 200, null, JSON.stringify({ title: "Static load test, run 3" })), { title: "Static load test, run 3" });
  assert.deepEqual(readAnswer("oembed", 200, null, "not json"), {});
  assert.deepEqual(readAnswer("page", 200, null, "<title>Google Docs</title>"), {});
  assert.equal(cleanTitle("GitHub - eli/rig: A test rig"), "eli/rig: A test rig");
  assert.equal(cleanTitle("x".repeat(200)).length, 118);
});
