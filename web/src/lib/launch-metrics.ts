// The launch numbers on the admin page (supabase/launch-metrics.sql, admin_launch_metrics()): the four
// that say whether Brazework works. Turned into tiles here, pure, so the arithmetic is tested
// (tests/launch-metrics.test.ts).

export type LaunchMetrics = {
  signed_weeks: { week: string; signed: number }[];
  asked: number; signed_48h: number; median_hours_ask_to_sign: number | null;
  first_results: number; second_within_30d: number;
  companies_verified: number; companies_looked: number; companies_wrote: number; companies_looked_and_wrote: number;
};

export type LaunchTile = { label: string; value: string; sub: string };

/** "+40%", "−20%", "new" when the week before had none, "–" when both had none. */
export function weekOverWeek(prev: number, cur: number): string {
  if (!prev) return cur ? "new" : "–";
  const p = Math.round(((cur - prev) / prev) * 100);
  return p > 0 ? `+${p}%` : p < 0 ? `−${Math.abs(p)}%` : "0%";
}

const share = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

/** The four tiles. Last week is the last full week; this week is shown as "so far". */
export function launchTiles(m: LaunchMetrics): LaunchTile[] {
  const w = m.signed_weeks;
  const thisWeek = w.at(-1)?.signed ?? 0;
  const lastWeek = w.at(-2)?.signed ?? 0;
  const before = w.at(-3)?.signed ?? 0;
  return [
    { label: "Signed results last week", value: `${lastWeek}`, sub: `${weekOverWeek(before, lastWeek)} on the week before · ${thisWeek} so far this week` },
    { label: "Signed within 48 hours", value: share(m.signed_48h, m.asked),
      sub: `of ${m.asked} ask${m.asked === 1 ? "" : "s"} (30 days)${m.median_hours_ask_to_sign == null ? "" : ` · median ${m.median_hours_ask_to_sign} h to sign`}` },
    { label: "Logged a second result", value: share(m.second_within_30d, m.first_results),
      sub: `within 30 days of the first · ${m.first_results} member${m.first_results === 1 ? "" : "s"} who started 30–120 days ago` },
    { label: "Companies that looked and wrote", value: `${m.companies_looked_and_wrote}`,
      sub: `${m.companies_looked} looked at a profile · ${m.companies_wrote} wrote · of ${m.companies_verified} verified (90 days)` },
  ];
}

/** "Nov 16" for a week's Monday (YYYY-MM-DD), in UTC like the database. */
export const weekLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
