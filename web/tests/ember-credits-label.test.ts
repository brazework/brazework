// What the buttons say a Torch action costs (lib/ember-credits.ts). A follow turn after a yes is free
// (supabase/ember-follow.sql). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMBER_CREDIT_COST, emberCreditCost } from "@/lib/ember-credits";

test("a follow turn is free and says so; the others cost what they did", () => {
  assert.equal(EMBER_CREDIT_COST.follow, 0);
  assert.equal(emberCreditCost("follow"), "free");
  assert.equal(emberCreditCost("ask"), "1 credit");
  assert.equal(emberCreditCost("writeup"), "3 credits");
});
