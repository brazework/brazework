// Torch's numbers on the admin page (lib/torch-metrics.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { answered, torchTiles, type TorchMetrics, type TorchTotals } from "@/lib/torch-metrics";

const zero: TorchTotals = { members: 0, asks: 0, follows: 0, prepared: 0, confirmed: 0, dismissed: 0, failed: 0, choices: 0 };
const m = (last: Partial<TorchTotals>, prev: Partial<TorchTotals> = {}): TorchMetrics => ({ days: [], last_7: { ...zero, ...last }, prev_7: { ...zero, ...prev } });

test("the tiles read the last 7 days against the 7 before", () => {
  const [members, confirmed, dismissed, failed] = torchTiles(m(
    { members: 12, asks: 40, follows: 9, prepared: 20, confirmed: 11, dismissed: 4, failed: 1, choices: 3 },
    { members: 10, prepared: 10, confirmed: 4 },
  ));
  assert.equal(members.value, "12");
  assert.equal(members.sub, "+20% on the week before · 40 questions, 9 free follow-ups");
  assert.equal(confirmed.value, "55%");
  assert.equal(confirmed.sub, "11 of 20 cards prepared · 40% the week before");
  assert.equal(dismissed.value, "20%");
  assert.equal(dismissed.sub, "4 dismissed · 4 never answered");
  assert.equal(failed.value, "6%", "of the cards that were answered");
  assert.equal(failed.sub, "1 of 16 answered cards · 3 sets of answer buttons offered");
});

test("a quiet week shows dashes, not NaN or 0%", () => {
  const tiles = torchTiles(m({}));
  assert.deepEqual(tiles.map((t) => t.value), ["0", "–", "–", "–"]);
  for (const t of tiles) assert.doesNotMatch(`${t.value} ${t.sub}`, /NaN|undefined|Infinity/);
  assert.match(tiles[0].sub, /^– on the week before · 0 questions, 0 free follow-ups$/);
});

test("singular words for one", () => {
  const tiles = torchTiles(m({ members: 1, asks: 1, follows: 1, prepared: 1, confirmed: 1, choices: 1 }));
  assert.match(tiles[0].sub, /1 question, 1 free follow-up$/);
  assert.match(tiles[1].sub, /^1 of 1 card prepared/);
  assert.match(tiles[3].sub, /^0 of 1 answered card · 1 set of answer buttons offered$/);
  assert.equal(answered({ ...zero, confirmed: 2, dismissed: 3, failed: 1 }), 6);
});

test("more answered than prepared (a card from before midnight) never shows a negative", () => {
  assert.match(torchTiles(m({ prepared: 1, confirmed: 3 }))[2].sub, / 0 never answered$/);
});
