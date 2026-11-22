// The launch numbers' tiles (lib/launch-metrics.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { launchTiles, weekLabel, weekOverWeek, type LaunchMetrics } from "@/lib/launch-metrics";

const base: LaunchMetrics = {
  signed_weeks: [0, 0, 0, 0, 0, 4, 10, 3].map((signed, i) => ({ week: `2026-10-${String(5 + i * 7).padStart(2, "0")}`, signed })),
  asked: 20, signed_48h: 13, median_hours_ask_to_sign: 9.5,
  first_results: 40, second_within_30d: 14,
  companies_verified: 6, companies_looked: 4, companies_wrote: 2, companies_looked_and_wrote: 2,
};

test("week over week: up, down, flat, new, nothing", () => {
  assert.equal(weekOverWeek(4, 10), "+150%");
  assert.equal(weekOverWeek(10, 5), "−50%");
  assert.equal(weekOverWeek(5, 5), "0%");
  assert.equal(weekOverWeek(0, 3), "new");
  assert.equal(weekOverWeek(0, 0), "–");
});

test("the four tiles: last full week with its growth, the 48-hour share, second results, companies", () => {
  const [signed, fast, second, companies] = launchTiles(base);
  assert.deepEqual([signed.value, fast.value, second.value, companies.value], ["10", "65%", "35%", "2"]);
  assert.match(signed.sub, /^\+150% on the week before · 3 so far this week$/);
  assert.match(fast.sub, /of 20 asks \(30 days\) · median 9\.5 h to sign/);
  assert.match(second.sub, /40 members who started 30–120 days ago/);
  assert.match(companies.sub, /4 looked at a profile · 2 wrote · of 6 verified/);
});

test("no data yet reads as dashes, never NaN or a division by zero", () => {
  const empty: LaunchMetrics = { ...base, signed_weeks: [], asked: 0, signed_48h: 0, median_hours_ask_to_sign: null, first_results: 0, second_within_30d: 0, companies_verified: 0, companies_looked: 0, companies_wrote: 0, companies_looked_and_wrote: 0 };
  const tiles = launchTiles(empty);
  assert.deepEqual(tiles.map((t) => t.value), ["0", "–", "–", "0"]);
  assert.ok(!tiles.some((t) => /NaN|Infinity|undefined/.test(t.value + t.sub)));
  assert.match(tiles[1].sub, /^of 0 asks \(30 days\)$/);
});

test("a week reads as its Monday, in UTC", () => assert.equal(weekLabel("2026-11-16"), "Nov 16"));
