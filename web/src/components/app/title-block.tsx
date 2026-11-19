import { cn } from "@/lib/forge";

// Where something stands, drawn like an engineering drawing's title block (docs/design/app.md): a few
// labelled cells in one ruled box. It replaces rows of "big number, small label" tiles. `wide` gives a
// cell a double share (a club's name, say); `ok` sets its value in the verified green (signed work only).

export type TitleCell = { label: string; value: React.ReactNode; tone?: "ok"; wide?: boolean };

export function TitleBlock({ label, cells, className }: { label: string; cells: TitleCell[]; className?: string }) {
  return (
    <dl aria-label={label} className={cn("grid grid-cols-2 overflow-hidden rounded-lg border border-line-strong bg-surface text-sm sm:flex", className)}>
      {cells.map((c) => (
        <div key={c.label} className={cn("-mt-px -ml-px min-w-0 border-t border-l border-line-strong px-3 py-2.5", c.wide ? "col-span-2 sm:flex-[1.6]" : "sm:flex-1")}>
          <dt className="text-xs text-muted">{c.label}</dt>
          <dd className={cn("mt-0.5 truncate font-medium tabular-nums", c.tone === "ok" ? "text-ok" : "text-text")}>{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
