"use client";
import { cn } from "@/lib/forge";

// Dashboard charts. Every chart is ONE series in ink (the app is monochrome, and a gray second series
// fails categorical contrast), so likes, comments and views are small multiples rather than one
// two-colour chart. Thin bars, 4px rounded tops on the baseline, 2px gaps, a tooltip on hover and
// focus, and a table for screen readers.

export type Point = { bucket: string; value: number };
export type Unit = "day" | "week" | "month";

export const fmtBucket = (b: string, unit: Unit) => {
  const d = new Date(`${b}T00:00:00Z`);
  return unit === "month"
    ? d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export function Bars({ series, unit, label, height = "h-40" }: { series: Point[]; unit: Unit; label: string; height?: string }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const total = series.reduce((n, s) => n + s.value, 0);
  if (!series.length) return null;
  return (
    <figure className="mt-4">
      <div className={cn("relative flex gap-[2px] pl-8", height)} role="img" aria-label={`${label} per ${unit}: ${total} in total, highest ${max}`}>
        {[0, Math.ceil(max / 2), max].map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-7 pr-1.5 text-right font-mono text-[10px] text-faint tabular-nums">{t}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        {series.map((s) => (
          <div key={s.bucket} tabIndex={0} className="group relative flex flex-1 items-end outline-none">
            <div className="w-full rounded-t-[4px] bg-text/80 transition group-hover:bg-text group-focus-visible:bg-text" style={{ height: `${Math.max(s.value ? 2 : 0, (s.value / max) * 100)}%` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 shadow-[var(--shadow)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <span className="text-muted">{fmtBucket(s.bucket, unit)}</span> · <span className="font-medium tabular-nums">{s.value}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-8 font-mono text-[10px] text-faint">
        <span>{fmtBucket(series[0].bucket, unit)}</span>
        <span>{fmtBucket(series.at(-1)!.bucket, unit)}</span>
      </div>
      <table className="sr-only">
        <caption>{label} per {unit}</caption>
        <tbody>{series.map((s) => <tr key={s.bucket}><th scope="row">{fmtBucket(s.bucket, unit)}</th><td>{s.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

// A tiny trend line for a stat tile: a 2px line with a soft fill under it (no end dot: the tile
// stretches the chart, which would squash a circle).
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const w = 120, h = 32, pad = 3;
  const max = Math.max(1, ...values);
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-8 w-full overflow-visible" role="img" aria-label={`${label} trend: ${values.join(", ")}`} preserveAspectRatio="none">
      <path d={`${line} L${x(values.length - 1)},${h} L${x(0)},${h} Z`} fill="var(--text)" opacity="0.06" />
      <path d={line} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.85" />
    </svg>
  );
}
