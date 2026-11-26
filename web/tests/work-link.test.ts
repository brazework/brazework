// Where a link to someone's work lives (lib/work-link.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanLink, workSource } from "@/lib/work-link";

test("each place engineers keep work is recognized, with the tool it implies", () => {
  assert.equal(workSource("https://github.com/acme/rig")?.id, "github");
  assert.equal(workSource("cad.onshape.com/documents/abc")?.id, "onshape");
  assert.equal(workSource("cad.onshape.com/documents/abc")?.tool, "Onshape");
  assert.equal(workSource("https://a360.co/3xYz")?.id, "other", "a short link stays unknown rather than guessed");
  assert.equal(workSource("https://myhub.autodesk360.com/g/shares/x")?.id, "fusion");
  assert.equal(workSource("https://docs.google.com/document/d/1")?.kind, "docs");
  assert.equal(workSource("https://youtu.be/cal")?.kind, "video");
  assert.equal(workSource("https://www.figma.com/file/x")?.tool, "Figma");
  assert.equal(workSource("https://wokwi.com/projects/1")?.id, "circuit");
});

test("unknown hosts are named by their host; things that aren't links are null", () => {
  assert.deepEqual(workSource("https://www.example.org/report.pdf"), { id: "other", label: "example.org", kind: "other" });
  assert.equal(workSource("not a link"), null);
  assert.equal(workSource(""), null);
  assert.equal(cleanLink("  cad.onshape.com/x "), "https://cad.onshape.com/x");
  assert.equal(cleanLink("http://a.b"), "http://a.b");
});
