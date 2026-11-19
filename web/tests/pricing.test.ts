// What Brazework costs (lib/pricing.ts): one config for the landing page and /pricing. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { AUDIENCES, PLUS, TIERS, tiersFor } from "@/lib/pricing";

test("every audience has tiers, and every tier says what it costs and what to do next", () => {
  for (const a of AUDIENCES) assert.ok(tiersFor(a.id).length >= 2, a.id);
  for (const t of TIERS) {
    assert.ok(t.price && t.note && t.points.length >= 3, t.id);
    assert.match(t.cta.href, /^\/(signup|#founding)$/, t.id);
  }
});

test("the record is free; the paid tier isn't called Pro and isn't sold before it can be bought", () => {
  assert.equal(tiersFor("builders")[0].price, "$0");
  assert.notEqual(PLUS.name.toLowerCase(), "pro", "Pro means pro verification");
  for (const t of TIERS) assert.ok(!/\bpro\b/i.test(t.name), t.name);
  const plus = TIERS.find((t) => t.id === "plus")!;
  assert.equal(plus.soon, !PLUS.sold);
  assert.ok(plus.price.includes(String(PLUS.student)) && plus.note.includes(String(PLUS.everyone)));
});
