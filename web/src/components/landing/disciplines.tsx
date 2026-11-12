import { BadgeCheck } from "lucide-react";
import { Head } from "./marketing";

// Every kind of engineering (Linear FIX-92): what proof looks like for software, mechanical,
// electrical, aerospace, structures and biomedical work, each as a quiet drawing that keeps moving
// (CSS only, stopped by the global reduced-motion rule; decorative, so hidden from screen readers).
// Each discipline has its own colour; the steps under it are what Brazework records.

type Discipline = { id: string; name: string; colour: string; line: string; steps: [string, string]; art: React.ReactNode };

// A gear outline: `teeth` trapezoids around a circle.
function gear(cx: number, cy: number, r: number, teeth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, s = (Math.PI * 2) / teeth;
    for (const [da, rr] of [[0, r], [s * 0.15, r + 6], [s * 0.45, r + 6], [s * 0.6, r]] as const) {
      pts.push(`${(cx + Math.cos(a + da) * rr).toFixed(1)},${(cy + Math.sin(a + da) * rr).toFixed(1)}`);
    }
  }
  return `M${pts.join(" L")} Z`;
}

const sine = Array.from({ length: 49 }, (_, i) => `${i * 7.5},${(60 + Math.sin(i * 0.785) * 22).toFixed(1)}`).join(" ");

const DISCIPLINES: Discipline[] = [
  {
    id: "software", name: "Software", colour: "#0284c7", line: "Ship it, and it's on the record.", steps: ["Pull request merged", "CI green on main"],
    art: (
      <>
        <path d="M10 84 H230" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
        <path className="dz-draw" d="M40 84 C60 84 60 40 90 40 H150 C180 40 180 84 200 84" fill="none" stroke="var(--dz)" strokeWidth="2.5" />
        {[20, 40, 200, 220].map((x) => <circle key={x} cx={x} cy="84" r="4" fill="var(--surface)" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />)}
        {[90, 120, 150].map((x) => <circle key={x} cx={x} cy="40" r="4" fill="var(--surface)" stroke="var(--dz)" strokeWidth="2" />)}
        <g className="dz-blink"><rect x="182" y="96" width="46" height="16" rx="4" fill="#16a34a" /><text x="205" y="107.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#fff">CI ✓</text></g>
      </>
    ),
  },
  {
    id: "mechanical", name: "Mechanical", colour: "#ea580c", line: "From CAD to the load test.", steps: ["CAD rev 4 + test rig", "Held 1.4 kN, no yield"],
    art: (
      <>
        <path className="dz-gear" d={gear(88, 60, 30, 12)} fill="none" stroke="var(--dz)" strokeWidth="2" />
        <circle cx="88" cy="60" r="7" fill="none" stroke="var(--dz)" strokeWidth="2" />
        <path className="dz-gear-back" d={gear(149, 60, 21, 9)} fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="149" cy="60" r="5" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
        <path d="M20 108 H220" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 4" />
      </>
    ),
  },
  {
    id: "electrical", name: "Electrical", colour: "#059669", line: "Board up, signal clean.", steps: ["PCB v2 brought up", "Scope capture, 0.4% ripple"],
    art: (
      <>
        {[30, 60, 90].map((y) => <path key={y} d={`M0 ${y} H240`} stroke="currentColor" strokeOpacity="0.12" />)}
        {[40, 80, 120, 160, 200].map((x) => <path key={x} d={`M${x} 10 V110`} stroke="currentColor" strokeOpacity="0.12" />)}
        <g className="dz-scroll"><polyline points={sine} fill="none" stroke="var(--dz)" strokeWidth="2.5" /><polyline points={sine} transform="translate(360 0)" fill="none" stroke="var(--dz)" strokeWidth="2.5" /></g>
      </>
    ),
  },
  {
    id: "aerospace", name: "Aerospace", colour: "#7c3aed", line: "The static fire, with the data.", steps: ["Thrust curve logged", "1.2 kN peak, within 3%"],
    art: (
      <>
        <path d="M20 100 H225 M20 100 V15" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M20 40 H225" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
        <path className="dz-draw" d="M20 100 C40 100 45 30 62 30 C78 30 82 44 100 46 C130 49 150 50 170 56 C185 61 190 98 225 100" fill="none" stroke="var(--dz)" strokeWidth="2.5" />
      </>
    ),
  },
  {
    id: "structures", name: "Structures", colour: "#ca8a04", line: "Load it and measure it.", steps: ["Truss built to spec", "2.1 mm deflection at 500 N"],
    art: (
      <>
        <g className="dz-flex">
          <path d="M20 80 L60 40 L100 80 L140 40 L180 80 L220 40 M20 80 H220 M60 40 H220" fill="none" stroke="var(--dz)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M120 8 V30 M114 24 L120 32 L126 24" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
        </g>
        <path d="M14 92 L26 92 L20 82 Z M208 92 L232 92" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeOpacity="0.35" />
      </>
    ),
  },
  {
    id: "biomedical", name: "Biomedical", colour: "#e11d48", line: "Protocol, results, sign-off.", steps: ["Sensor validated on 12 runs", "Matched reference ±2 bpm"],
    art: (
      <>
        <path d="M0 64 H240" stroke="currentColor" strokeOpacity="0.12" />
        <path className="dz-sweep" d="M0 64 H60 L70 64 L78 30 L88 96 L96 64 H150 L160 64 L168 30 L178 96 L186 64 H240" fill="none" stroke="var(--dz)" strokeWidth="2.5" strokeLinejoin="round" />
      </>
    ),
  },
];

export function Disciplines() {
  return (
    <section id="disciplines" data-story="Every kind of engineering" className="story-sec scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Every kind of engineering" title="Whatever you build," accent="it becomes proof." body="Code, CAD, circuits, rockets, bridges, devices: each kind of work has its own kind of evidence. Brazework records it as you go, and your club signs off on it." />
        <ul className="no-scrollbar mt-10 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {DISCIPLINES.map((d) => (
            <li key={d.id} className="w-[80%] shrink-0 snap-start sm:w-auto" style={{ ["--dz" as string]: d.colour }}>
              <article className="h-full overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-line-strong">
                <div className="relative h-32 border-b border-line bg-surface-2/60 text-text" aria-hidden="true">
                  <svg viewBox="0 0 240 120" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet">{d.art}</svg>
                </div>
                <div className="p-5">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted"><span className="size-2 rounded-full" style={{ background: d.colour }} /> {d.name}</p>
                  <h3 className="mt-2 text-[17px] font-semibold tracking-tight">{d.line}</h3>
                  <ol className="mt-3 flex flex-col gap-1.5 text-sm text-text-2">
                    {d.steps.map((s) => <li key={s} className="flex items-center gap-2"><span className="size-1.5 shrink-0 rounded-full bg-line-strong" /> {s}</li>)}
                    <li className="flex items-center gap-2 font-medium text-ok"><BadgeCheck className="size-4 shrink-0" /> Verified by your club</li>
                  </ol>
                </div>
              </article>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-faint">Example results</p>
      </div>
    </section>
  );
}
