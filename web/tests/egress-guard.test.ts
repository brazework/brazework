// Guards for Supabase bandwidth (Linear FIX-75): cached egress hit 9 GB for 5 users when big videos
// autoplayed for everyone who scrolled past them, and signed links were minted fresh on every render.
// These checks fail CI if those patterns come back. How files should load: docs/architecture.md.
// Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { VIDEO_MAX_BYTES, validMedia } from "@/lib/media";

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

// Videos stream only after a tap (FIX-10): preload="none" everywhere, with a poster image instead. The
// exceptions: the reel (opening it is asking to watch) and previews of a file still on your device.
const PRELOAD_OK = new Set(["app/(app)/projects/[id]/reel/player.tsx", "components/media/annotate.tsx", "components/media/attach.tsx"]);
test("every Storage <video> has preload=\"none\" (nothing downloads until someone taps play)", () => {
  const bad = all.flatMap((f) => videoTags(f.text).filter((tag) => (PRELOAD_OK.has(f.path) ? !/\bpreload="(none|metadata)"/.test(tag) : !/\bpreload="none"/.test(tag))).map(() => f.path));
  assert.deepEqual(bad, [], "add preload=\"none\" and a poster, so a video doesn't download before anyone plays it");
});

test("autoPlay only in the reel (opening a reel is asking to watch); feed videos never autoplay", () => {
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

test("the server keeps a file's size, and refuses a bad one", () => {
  const me = "a06de495-4f6b-4649-8878-77f8b718e0ea";
  const path = `${me}/5746fbce-5cfb-4849-8302-0123456789ab.mp4`;
  assert.equal(validMedia([{ type: "video", path, bytes: 38_000_000 }], me)?.[0].bytes, 38_000_000);
  assert.equal(validMedia([{ type: "video", path, bytes: -5 }], me), null);
  assert.equal(validMedia([{ type: "video", path, bytes: 1.5 }], me), null);
  assert.equal(validMedia([{ type: "video", path, bytes: VIDEO_MAX_BYTES }], me)?.[0].bytes, VIDEO_MAX_BYTES, "videos up to 250 MB (Pro)");
  assert.equal(validMedia([{ type: "video", path, bytes: VIDEO_MAX_BYTES + 1 }], me), null, "over the 250 MB video limit");
  assert.equal(validMedia([{ type: "image", path: `${me}/5746fbce-5cfb-4849-8302-0123456789ab.webp`, bytes: 60_000_000 }], me), null, "images stay at 50 MB");
  assert.equal(validMedia([{ type: "video", path }], me)?.[0].bytes, undefined, "older items without a size still validate");
});

test("a video's poster: a WebP in your own folder, on videos only", () => {
  const me = "a06de495-4f6b-4649-8878-77f8b718e0ea";
  const path = `${me}/5746fbce-5cfb-4849-8302-0123456789ab.mp4`;
  const poster = `${me}/0b1c2d3e-4f50-4617-8899-aabbccddeeff.webp`;
  assert.equal(validMedia([{ type: "video", path, poster }], me)?.[0].poster, poster);
  assert.equal(validMedia([{ type: "video", path, poster: `00000000-0000-4000-8000-000000000000/0b1c2d3e-4f50-4617-8899-aabbccddeeff.webp` }], me), null, "someone else's folder");
  assert.equal(validMedia([{ type: "video", path, poster: `${me}/0b1c2d3e-4f50-4617-8899-aabbccddeeff.jpg` }], me), null, "not a WebP");
  assert.equal(validMedia([{ type: "image", path: poster, poster }], me), null, "posters are for videos");
  assert.equal(validMedia([{ type: "video", path }], me)?.[0].poster, undefined, "older videos without a poster still validate");
});
