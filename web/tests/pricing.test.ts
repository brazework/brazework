// What Brazework costs (lib/pricing.ts): one config for the landing page and /pricing. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { AUDIENCES, PLUS, SALES, SALES_KINDS, TIERS, tiersFor } from "@/lib/pricing";

test("every audience has two tiers and exactly one primary call to action", () => {
  for (const a of AUDIENCES) {
    assert.equal(tiersFor(a.id).length, 2, a.id);
    assert.equal(tiersFor(a.id).filter((t) => t.featured).length, 1, `${a.id}: one primary`);
  }
  for (const t of TIERS) {
    assert.ok(t.price && t.note && t.points.length >= 3, t.id);
    assert.match(t.cta.href, /^\/(signup|plus|#founding|book\?kind=(talent|chapter|challenge|school))$/, t.id);
  }
});

test("each paying audience has a paid path, and every /book link is a kind the database accepts", () => {
  assert.ok(TIERS.some((t) => t.audience === "builders" && t.cta.href === "/plus"));
  assert.ok(tiersFor("companies").every((t) => t.cta.href.startsWith("/book?kind=")));
  assert.ok(tiersFor("organizations").some((t) => t.cta.href === "/book?kind=school"));
  for (const t of TIERS) {
    const kind = t.cta.href.match(/kind=(\w+)/)?.[1];
    if (kind) assert.ok((SALES_KINDS as readonly string[]).includes(kind), kind);
  }
  for (const k of SALES_KINDS) assert.ok(SALES[k].label && SALES[k].ask, k);
});

test("the record is free; the paid tier isn't called Pro and its prices come from one place", () => {
  assert.equal(tiersFor("builders")[0].price, "$0");
  assert.notEqual(PLUS.name.toLowerCase(), "pro", "Pro means pro verification");
  for (const t of TIERS) assert.ok(!/\bpro\b/i.test(t.name), t.name);
  const plus = TIERS.find((t) => t.id === "plus")!;
  assert.ok(plus.price.includes(String(PLUS.student)) && plus.note.includes(String(PLUS.everyone)));
});

test("Plus never sells what isn't built: everything still coming is marked coming soon", async () => {
  const { PLUS_SOON } = await import("@/lib/pricing");
  const plus = TIERS.find((t) => t.id === "plus")!;
  for (const soon of PLUS_SOON) assert.ok(plus.points.includes(`${soon} (coming soon)`), soon);
  assert.ok(plus.points.some((p) => p.includes("90 days") && !p.includes("coming soon")), "who looked over 90 days is built");
});

test("Plus leads with the review packet, says plainly it's free during launch, and shows the yearly prices", () => {
  const plus = TIERS.find((t) => t.id === "plus")!;
  assert.match(plus.points[1], /review packet/i, "the packet is the first thing Plus adds");
  assert.match(plus.points[1], /free for everyone during launch/, "it's a Plus preview today, and says so");
  assert.ok(plus.note.includes(`$${PLUS.studentYear}`) && plus.note.includes(`$${PLUS.everyoneYear}`), plus.note);
  assert.ok(PLUS.everyoneYear < PLUS.everyone * 12 && PLUS.studentYear < PLUS.student * 12, "a year costs less than twelve months");
});
