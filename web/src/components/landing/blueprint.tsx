import { cn } from "@/lib/forge";

// Engineering-drawing parts for the blueprint pages. Pure SVG and CSS: the line art draws itself
// in with .bp-draw (pathLength="1"), so it works before and without JavaScript.

const ink = "var(--ink)";
const mono = "var(--font-mono)";

// "FIG. 02 — THE PROBLEM"
export function FigLabel({ n, children, className }: { n: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-accent uppercase", className)}>
      <span>FIG. {n}</span>
      <span className="h-px w-8 bg-accent/50" aria-hidden="true" />
      <span className="text-faint">{children}</span>
    </div>
  );
}

// L-shaped crop marks in the four corners of a panel (the parent needs `relative`).
export function CornerMarks({ className }: { className?: string }) {
  const m = "pointer-events-none absolute size-3 border-accent/70";
  return (
    <span aria-hidden="true" className={className}>
      <span className={cn(m, "top-0 left-0 border-t border-l")} />
      <span className={cn(m, "top-0 right-0 border-t border-r")} />
      <span className={cn(m, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(m, "right-0 bottom-0 border-r border-b")} />
    </span>
  );
}

// A drawing's title block: the box in the corner of every engineering sheet.
export function TitleBlock({ rows, className }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 border border-line-strong font-mono text-[10px] tracking-wide uppercase", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="border-line-strong px-2 py-1 odd:border-r [&:nth-child(n+3)]:border-t">
          <dt className="text-faint">{k}</dt>
          <dd className="text-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// The hero drawing: a club rocket in CAD style, with dimensions and three numbered callouts
// that tell the Forge story (your club → your work → get hired).
export function RocketDrawing({ className }: { className?: string }) {
  const d = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;
  return (
    <svg viewBox="0 0 560 560" className={cn("h-auto w-full", className)} role="img" aria-label="A technical drawing of a club rocket, labelled: your club, your work, get hired.">
      <defs>
        <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={ink} />
        </marker>
        <marker id="bp-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
          <circle cx="5" cy="5" r="3" fill={ink} />
        </marker>
      </defs>
      <g fill="none" stroke={ink} strokeLinejoin="round" strokeLinecap="round">
        {/* centre line */}
        <path className="bp-draw" pathLength={1} style={d(0)} d="M330 36 V500" strokeWidth="1" strokeDasharray="10 4 2 4" opacity="0.6" />
        {/* nose cone, body, fins, nozzle */}
        <path className="bp-draw" pathLength={1} style={d(0.1)} d="M290 190 C292 120 312 72 330 52 C348 72 368 120 370 190" strokeWidth="2" />
        <path className="bp-draw" pathLength={1} style={d(0.3)} d="M290 190 H370 V420 H290 Z" strokeWidth="2" />
        <path className="bp-draw" pathLength={1} style={d(0.5)} d="M290 340 L240 430 L290 420" strokeWidth="2" />
        <path className="bp-draw" pathLength={1} style={d(0.5)} d="M370 340 L420 430 L370 420" strokeWidth="2" />
        <path className="bp-draw" pathLength={1} style={d(0.7)} d="M305 420 L298 450 H362 L355 420" strokeWidth="2" />
        {/* details: payload bay, window, rivets */}
        <path className="bp-draw" pathLength={1} style={d(0.8)} d="M290 260 H370 M290 300 H370" strokeWidth="1" opacity="0.7" />
        <circle className="bp-draw" pathLength={1} style={d(0.9)} cx="330" cy="225" r="13" strokeWidth="1.5" />
        {/* exhaust */}
        <path className="bp-draw" pathLength={1} style={d(1.1)} d="M312 462 Q330 520 348 462 M320 462 Q330 495 340 462" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.8" />
        {/* height dimension */}
        <path className="bp-draw" pathLength={1} style={d(1.2)} d="M470 52 V450" strokeWidth="1" markerStart="url(#bp-arrow)" markerEnd="url(#bp-arrow)" />
        <path className="bp-draw" pathLength={1} style={d(1.2)} d="M378 52 H482 M366 450 H482" strokeWidth="0.75" opacity="0.6" />
        {/* diameter dimension */}
        <path className="bp-draw" pathLength={1} style={d(1.3)} d="M290 486 H370" strokeWidth="1" markerStart="url(#bp-arrow)" markerEnd="url(#bp-arrow)" />
        <path className="bp-draw" pathLength={1} style={d(1.3)} d="M290 424 V496 M370 424 V496" strokeWidth="0.75" opacity="0.6" />
        {/* callout leaders */}
        <path className="bp-draw" pathLength={1} style={d(1.4)} d="M318 110 L250 110 L190 96" strokeWidth="1" markerStart="url(#bp-dot)" />
        <path className="bp-draw" pathLength={1} style={d(1.6)} d="M292 280 L190 280" strokeWidth="1" markerStart="url(#bp-dot)" />
        <path className="bp-draw" pathLength={1} style={d(1.8)} d="M250 418 L190 470" strokeWidth="1" markerStart="url(#bp-dot)" />
      </g>
      <g fontFamily={mono} fontSize="13" fill="var(--text)">
        <text className="bp-label" style={d(1.3)} x="482" y="256" transform="rotate(90 482 256)" textAnchor="middle" fill="var(--muted)">410 mm</text>
        <text className="bp-label" style={d(1.4)} x="330" y="514" textAnchor="middle" fill="var(--muted)">Ø 80</text>
        <text className="bp-label" style={d(1.5)} x="24" y="92" fontWeight="600">01 · YOUR CLUB</text>
        <text className="bp-label" style={d(1.5)} x="24" y="110" fontSize="11" fill="var(--muted)">runs on Forge</text>
        <text className="bp-label" style={d(1.7)} x="24" y="276" fontWeight="600">02 · YOUR WORK</text>
        <text className="bp-label" style={d(1.7)} x="24" y="294" fontSize="11" fill="var(--muted)">attested by the club</text>
        <text className="bp-label" style={d(1.9)} x="24" y="466" fontWeight="600">03 · GET HIRED</text>
        <text className="bp-label" style={d(1.9)} x="24" y="484" fontSize="11" fill="var(--muted)">by people who saw it</text>
      </g>
    </svg>
  );
}

// Club → Work → Hired, as a flow diagram with arrows between the boxes.
export function FlowArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 24" className={cn("h-6 w-16 shrink-0", className)} aria-hidden="true">
      <path className="bp-draw" pathLength={1} d="M2 12 H74" stroke={ink} strokeWidth="1.5" fill="none" markerEnd="url(#bp-flow-arrow)" />
      <defs>
        <marker id="bp-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={ink} />
        </marker>
      </defs>
    </svg>
  );
}
