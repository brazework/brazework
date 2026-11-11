// Guards for Supabase bandwidth (Linear FIX-75): cached egress hit 9 GB for 5 users when big videos
// autoplayed for everyone who scrolled past them, and signed links were minted fresh on every render.
// These checks fail CI if those patterns come back. How files should load: docs/architecture.md.
// Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { AUTOPLAY_MAX_BYTES, autoplays, validMedia } from "@/lib/media";

const SRC = join(__dirname, "..", "src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : []; });
const all = files(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, "utf8") }));
// Each JSX <video ...> opening tag, whole (it can span lines).
const videoTags = (t: string) => t.match(/<video\b[^>]*>/g) ?? [];

test("signed links are only made where they're reused (lib/signed-urls.ts) or when a file is opened (lib/project-files.ts)", () => {
  const allowed = new Set(["lib/signed-urls.ts", "lib/project-files.ts"]);
  const offenders = all.filter((f) => /createSignedUrls?\(/.test(f.text) && !allowed.has(f.path)).map((f) => f.path);
  assert.deepEqual(offenders, [], "make signed links with signedUrls() from lib/signed-urls.ts, so they stay the same between renders");
});

test("every <video> says how much to preload, and never 'auto'", () => {
  const bad = all.flatMap((f) => videoTags(f.text).filter((tag) => !/\bpreload=/.test(tag) || /preload="auto"/.test(tag)).map(() => f.path));
  assert.deepEqual(bad, [], "add preload=\"metadata\" (or \"none\") so a video doesn't download before anyone plays it");
});

test("autoPlay only in the reel (opening a reel is asking to watch); feed videos go through autoplays()", () => {
  const bad = all.flatMap((f) => videoTags(f.text).filter((tag) => /\bautoPlay\b/.test(tag)).map(() => f.path)).filter((p) => p !== "app/(app)/projects/[id]/reel/player.tsx");
  assert.deepEqual(bad, []);
});

test("every Storage upload sets a long cache (files never change; a new upload gets a new path)", () => {
  // The call and its options: from ".upload(" to the end of its statement.
  const calls = (t: string) => [...t.matchAll(/\.upload\(/g)].map((m) => t.slice(m.index, t.indexOf(";", m.index) + 1));
  const bad = all.filter((f) => /storage/.test(f.text)).flatMap((f) => calls(f.text).filter((call) => !/cacheControl:\s*"31536000"/.test(call)).map(() => f.path));
  assert.deepEqual(bad, [], "pass cacheControl: \"31536000\" (and upsert: false)");
});

test("no raw <img> for Storage files: they go through next/image, which serves a resized copy", () => {
  const bad = all.flatMap((f) => (f.text.match(/<img\b[^>]*>/g) ?? []).filter((tag) => /src=\{[^}]*(mediaUrl\(|signed|\.src\b)/.test(tag)).map(() => f.path));
  assert.deepEqual(bad, []);
});

test("autoplay: small clips with a saved size only", () => {
  assert.ok(autoplays({ type: "video", path: "u/a.mp4", bytes: 2 * 1048576 }));
  assert.ok(autoplays({ type: "video", path: "u/a.mp4", bytes: AUTOPLAY_MAX_BYTES }));
  assert.ok(!autoplays({ type: "video", path: "u/a.mp4", bytes: AUTOPLAY_MAX_BYTES + 1 }), "a big video waits for a tap");
  assert.ok(!autoplays({ type: "video", path: "u/a.mp4" }), "an older video with no saved size waits for a tap");
  assert.ok(!autoplays({ type: "image", path: "u/a.webp", bytes: 1000 }));
});

test("the server keeps a file's size, and refuses a bad one", () => {
  const me = "a06de495-4f6b-4649-8878-77f8b718e0ea";
  const path = `${me}/5746fbce-5cfb-4849-8302-0123456789ab.mp4`;
  assert.equal(validMedia([{ type: "video", path, bytes: 38_000_000 }], me)?.[0].bytes, 38_000_000);
  assert.equal(validMedia([{ type: "video", path, bytes: -5 }], me), null);
  assert.equal(validMedia([{ type: "video", path, bytes: 1.5 }], me), null);
  assert.equal(validMedia([{ type: "video", path, bytes: 99_000_000 }], me), null, "over the 50 MB upload limit");
  assert.equal(validMedia([{ type: "video", path }], me)?.[0].bytes, undefined, "older items without a size still validate");
});
