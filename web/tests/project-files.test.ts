// A project's files folder: which files it takes, how links are named, and that nothing uploaded can
// be served as a web page. supabase/project-files.sql checks the same extensions. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ACCEPTED_EXTS, cleanUrl, extOf, githubRepo, kindOfFile, sizeLabel, storedType } from "@/lib/project-file-types";

test("files are sorted into the right kind by extension, case-insensitively", () => {
  assert.equal(kindOfFile("bracket.STL"), "model");
  assert.equal(kindOfFile("rover.glb"), "model");
  assert.equal(kindOfFile("chassis.step"), "cad");
  assert.equal(kindOfFile("report.pdf"), "pdf");
  assert.equal(kindOfFile("board.kicad_pcb"), "cad");
  assert.equal(kindOfFile("flight.ino"), "code");
  assert.equal(kindOfFile("demo.mov"), "video");
  assert.equal(extOf("no-extension"), "");
});

test("web pages, SVGs and programs are refused", () => {
  for (const name of ["index.html", "page.htm", "logo.svg", "run.exe", "x.sh", "noext"]) assert.equal(kindOfFile(name), null, name);
});

test("only photos, video, PDFs and plain text keep a type a browser would display", () => {
  assert.equal(storedType("a.png"), "image/png");
  assert.equal(storedType("a.pdf"), "application/pdf");
  assert.equal(storedType("notes.md"), "text/plain");
  assert.equal(storedType("script.js"), "application/octet-stream");
  assert.equal(storedType("part.stl"), "application/octet-stream");
});

test("the app and the database accept the same extensions", () => {
  const sql = readFileSync(new URL("../../supabase/project-files.sql", import.meta.url), "utf8");
  const list = sql.match(/project_file_ext_ok[\s\S]*?array\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const dbExts = [...list.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual([...ACCEPTED_EXTS].sort(), dbExts);
});

test("GitHub links are named after the repo", () => {
  assert.equal(githubRepo("https://github.com/brazework/forge-app"), "brazework/forge-app");
  assert.equal(githubRepo("https://www.github.com/a/b.git"), "a/b");
  assert.equal(githubRepo("https://github.com/a/b/tree/main/src"), "a/b");
  assert.equal(githubRepo("https://github.com/a"), null);
  assert.equal(githubRepo("https://gitlab.com/a/b"), null);
});

test("pasted links get https, and non-links are refused", () => {
  assert.equal(cleanUrl("github.com/a/b"), "https://github.com/a/b");
  assert.equal(cleanUrl("  https://cad.onshape.com/documents/1 "), "https://cad.onshape.com/documents/1");
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(cleanUrl("not a link"), null);
  assert.equal(cleanUrl(""), null);
});

test("sizes read the way people say them", () => {
  assert.equal(sizeLabel(512), "512 B");
  assert.equal(sizeLabel(2048), "2 KB");
  assert.equal(sizeLabel(3.5 * 1024 * 1024), "3.5 MB");
  assert.equal(sizeLabel(38 * 1024 * 1024), "38 MB");
});
