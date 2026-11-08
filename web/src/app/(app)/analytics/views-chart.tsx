"use client";

// One series over time: thin ink bars, 4px rounded tops anchored to the baseline, 2px gaps,
// a tooltip on hover/focus, and a table for screen readers (dataviz guidance; no legend for one series).
export function ViewsChart({ series, unit }: { series: { bucket: string; views: number }[]; unit: "day" | "week" | "month" }) {
  const max = Math.max(1, ...series.map((s) => s.views));
  const fmt = (b: string) => {
    const d = new Date(`${b}T00:00:00Z`);
    return unit === "month"
      ? d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };
  const ticks = [0, Math.ceil(max / 2), max];
  if (!series.length) return <p className="mt-4 text-sm text-muted">No views yet.</p>;
  return (
    <figure className="mt-5">
      <div className="relative flex h-44 gap-[2px] pl-8" role="img" aria-label={`Profile views per ${unit}, highest ${max}`}>
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-7 pr-1.5 text-right font-mono text-[10px] text-faint tabular-nums">{t}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        {series.map((s) => (
          <div key={s.bucket} tabIndex={0} className="group relative flex flex-1 items-end outline-none">
            <div className="w-full rounded-t-[4px] bg-text/80 transition group-hover:bg-text group-focus-visible:bg-text" style={{ height: `${Math.max(s.views ? 2 : 0, (s.views / max) * 100)}%` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 shadow-[var(--shadow)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <span className="text-muted">{fmt(s.bucket)}</span> · <span className="font-medium tabular-nums">{s.views}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-8 font-mono text-[10px] text-faint">
        <span>{fmt(series[0].bucket)}</span>
        <span>{fmt(series.at(-1)!.bucket)}</span>
      </div>
      <table className="sr-only">
        <caption>Profile views per {unit}</caption>
        <tbody>{series.map((s) => <tr key={s.bucket}><th scope="row">{fmt(s.bucket)}</th><td>{s.views}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
