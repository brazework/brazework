// The redesign's rules, kept (Linear FIX-87). Buttons have 8px corners, nothing glows, nothing lifts
// on hover: one-off classes in a page are how a design system drifts, so this fails CI instead.
// Avatars, dots and small chips are still round; only button-shaped things are checked.
// Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const WEB = join(__dirname, "..");
// The reel player is a full-screen cinema view with its own look.
const EXEMPT = ["src/app/(app)/projects/[id]/reel/"];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
const files = walk(join(WEB, "src"))
  .map((p) => ({ path: relative(WEB, p), lines: readFileSync(p, "utf8").split("\n") }))
  .filter((f) => !EXEMPT.some((e) => f.path.startsWith(e)));

// Each match with where it is, so a failure says exactly what to fix.
const find = (re: RegExp, keep: (run: string) => boolean = () => true) =>
  files.flatMap((f) =>
    f.lines.flatMap((line, i) =>
      [...line.matchAll(re)].filter((m) => keep(classRun(line, m.index ?? 0))).map(() => `${f.path}:${i + 1}`),
    ),
  );

// The classes around a match: up to the nearest quote, backtick or brace on either side.
export function classRun(line: string, at: number): string {
  const stop = /["'`{}]/;
  let a = at;
  while (a > 0 && !stop.test(line[a - 1])) a--;
  let b = at;
  while (b < line.length && !stop.test(line[b])) b++;
  return line.slice(a, b);
}

// A button or input: a button height (h-8 to h-12, or py-2 and up) and horizontal padding.
export const buttonShaped = (run: string) =>
  /(^|\s)((sm|md):)?(h-(8|9|10|11|12)|py-(2|2\.5|3|3\.5))(?=\s|$)/.test(run) && /(^|\s)((sm|md):)?(px|pl)-[0-9.]+(?=\s|$)/.test(run);

test("the guard tells a button from an avatar or a chip", () => {
  assert.equal(buttonShaped("inline-flex h-9 items-center rounded-full px-4 text-sm"), true);
  assert.equal(buttonShaped("rounded-full border px-4 py-2 text-sm"), true);
  assert.equal(buttonShaped("size-9 rounded-full"), false, "an avatar or icon circle");
  assert.equal(buttonShaped("rounded-full px-2.5 py-1 text-xs"), false, "a small chip");
  assert.equal(classRun(`a="size-9 rounded-full" b="h-9 px-4"`, 11), "size-9 rounded-full", "one class string, not its neighbours");
});

test("buttons and inputs use rounded-lg, not pills", () => {
  assert.deepEqual(find(/(?<=^|[\s"'`])rounded-full(?=[\s"'`]|$)/g, buttonShaped), [], "use rounded-lg (or <Button>)");
});

test("nothing glows: no accent-coloured drop shadows, no blurred glow blobs", () => {
  assert.deepEqual(find(/shadow-\[0_[1-9][0-9]*px_[^\]]*var\(--accent\)/g), [], "drop the glow; a primary button stands out by its fill");
  assert.deepEqual(find(/(?<=^|[\s"'`])blur-(2xl|3xl)(?=[\s"'`]|$)/g), [], "no glow blobs behind content");
});

test("hover doesn't lift: no translate or big-shadow hovers", () => {
  assert.deepEqual(find(/(?<=^|[\s"'`])(group-)?hover:-translate-y-/g), [], "use hover:border-line-strong or hover:bg-hover");
  assert.deepEqual(find(/hover:shadow-\[/g), [], "use hover:border-line-strong");
});
