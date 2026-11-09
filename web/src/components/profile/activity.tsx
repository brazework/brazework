// The last 15 weeks of someone's posts as a grid, a week per column and a day per square, darker
// the more they posted that day. One ink, stepped (sequential), with each square titled for hover
// and the totals in words for screen readers.
const WEEKS = 15;
const DAY = 864e5;

export function ActivityGrid({ dates, now }: { dates: string[]; now: number }) {
  // Days keyed in UTC so the server and browser agree.
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(key(Date.parse(d)), (counts.get(key(Date.parse(d))) ?? 0) + 1);
  const today = new Date(now);
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const start = end - ((WEEKS - 1) * 7 + today.getUTCDay()) * DAY; // a Sunday, 15 columns back
  const days = Array.from({ length: (end - start) / DAY + 1 }, (_, i) => start + i * DAY);
  const total = days.reduce((n, d) => n + (counts.get(key(d)) ?? 0), 0);
  const active = days.filter((d) => counts.get(key(d))).length;
  const level = (n: number) => (n === 0 ? "bg-raised" : n === 1 ? "bg-text/35" : n === 2 ? "bg-text/60" : "bg-text/90");
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <figure>
      <div className="flex gap-[3px]" role="img" aria-label={`${total} posts on ${active} days in the last ${WEEKS} weeks`}>
        {weeks.map((wk, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {wk.map((d) => {
              const n = counts.get(key(d)) ?? 0;
              return <span key={d} title={`${new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}: ${n} post${n === 1 ? "" : "s"}`} className={`size-3 rounded-[3px] ${level(n)}`} />;
            })}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>{total} post{total === 1 ? "" : "s"} in {WEEKS} weeks</span>
        <span className="flex items-center gap-1">Less {[0, 1, 2, 3].map((n) => <span key={n} className={`size-2.5 rounded-[2px] ${level(n)}`} />)} More</span>
      </figcaption>
    </figure>
  );
}
