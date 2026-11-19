// Vercel's Ignored Build Step (web/vercel.json → ignoreCommand). Exit 0 skips the build, anything else builds.
// It must skip only what it knows is a preview, and build whenever it can't tell: on Nov 19 2026 an empty
// VERCEL_ENV made the old rule skip every production deploy for three merges. Run: npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { ignoreCommand } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { ignoreCommand: string };

// Only the variables given, like Vercel's build step when its system variables aren't exposed.
const skips = (env: Record<string, string>) =>
  spawnSync("/bin/sh", ["-c", ignoreCommand], { env: env as unknown as NodeJS.ProcessEnv }).status === 0;

test("main always builds, even when Vercel's system variables are missing", () => {
  assert.equal(skips({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }), false);
  assert.equal(skips({ VERCEL_GIT_COMMIT_REF: "main" }), false);
  assert.equal(skips({ VERCEL_ENV: "", VERCEL_GIT_COMMIT_REF: "" }), false);
  assert.equal(skips({}), false);
});

test("previews and other branches are skipped, for speed", () => {
  assert.equal(skips({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "fix-30-topic" }), true);
  assert.equal(skips({ VERCEL_ENV: "preview" }), true);
  assert.equal(skips({ VERCEL_GIT_COMMIT_REF: "fix-30-topic" }), true);
});
