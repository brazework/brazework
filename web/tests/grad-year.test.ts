// Graduation year: optional, a real year, and the choices fit students and recent alumni. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { classOf, gradYearOptions, parseGradYear } from "@/lib/profile-meta";

test("empty clears it; a year in range is kept", () => {
  assert.deepEqual(parseGradYear(""), { ok: true, value: null });
  assert.deepEqual(parseGradYear(null), { ok: true, value: null });
  assert.deepEqual(parseGradYear("2027"), { ok: true, value: 2027 });
});

test("anything else is refused (the database checks the same range)", () => {
  for (const bad of ["1900", "2099", "27", "2027.5", "next year", "2027; drop table"]) assert.deepEqual(parseGradYear(bad), { ok: false }, bad);
});

test("the choices run six years ahead to ten back, newest first", () => {
  const years = gradYearOptions(new Date("2026-11-10T00:00:00Z"));
  assert.equal(years[0], 2032);
  assert.equal(years.at(-1), 2016);
  assert.equal(years.length, 17);
  assert.ok(years.every((y) => parseGradYear(String(y)).ok));
});

test("label", () => {
  assert.equal(classOf(2027), "Class of 2027");
  assert.equal(classOf(null), "");
});
