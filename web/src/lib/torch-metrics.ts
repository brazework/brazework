// Torch's numbers on the admin page (supabase/ember-card-counts.sql, admin_torch_metrics()): totals across
// all members, never one member's, and never what anyone said. Turned into tiles here, pure, so the
// arithmetic is tested (tests/torch-metrics.test.ts).
import { weekOverWeek } from "@/lib/launch-metrics";

export type TorchTotals = { members: number; asks: number; follows: number; prepared: number; confirmed: number; dismissed: number; failed: number; choices: number };
export type TorchDay = TorchTotals & { day: string };
export type TorchMetrics = { days: TorchDay[]; last_7: TorchTotals; prev_7: TorchTotals };

export type TorchTile = { label: string; value: string; sub: string };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Cards the member answered, one way or another. Ones never answered are the rest of `prepared`. */
export const answered = (t: TorchTotals) => t.confirmed + t.dismissed + t.failed;

/** The four tiles, for the last 7 days against the 7 before. */
export function torchTiles(m: TorchMetrics): TorchTile[] {
  const a = m.last_7, b = m.prev_7;
  const unanswered = Math.max(0, a.prepared - answered(a));
  return [
    { label: "Members using Torch", value: `${a.members}`, sub: `${weekOverWeek(b.members, a.members)} on the week before · ${plural(a.asks, "question")}, ${plural(a.follows, "free follow-up")}` },
    { label: "Cards confirmed", value: pct(a.confirmed, a.prepared), sub: `${a.confirmed} of ${plural(a.prepared, "card")} prepared · ${pct(b.confirmed, b.prepared)} the week before` },
    { label: "Cards dismissed", value: pct(a.dismissed, a.prepared), sub: `${a.dismissed} dismissed · ${unanswered} never answered` },
    { label: "Cards that didn't go through", value: pct(a.failed, answered(a)), sub: `${a.failed} of ${plural(answered(a), "answered card")} · ${plural(a.choices, "set")} of answer buttons offered` },
  ];
}
