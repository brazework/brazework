import { BadgeCheck } from "lucide-react";
import { Head } from "./marketing";
import { Orb } from "./orb";

// Every kind of engineering (Linear FIX-92): what proof looks like for software, mechanical,
// electrical, aerospace, structures and biomedical work, each as a quiet drawing that keeps moving
// (CSS only, stopped by the global reduced-motion rule; decorative, so hidden from screen readers).
// Black and white: obsidian cards on either theme, white linework, and the black orb behind the
// heading. The steps under each drawing are what Brazework records.

type Discipline = { id: string; name: string; line: string; steps: [string, string]; art: React.ReactNode };

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
    id: "software", name: "Software", line: "Ship it, and it's on the record.", steps: ["Pull request merged", "CI green on main"],
    art: (
      <>
        <path d="M10 84 H230" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
        <path className="dz-draw" d="M40 84 C60 84 60 40 90 40 H150 C180 40 180 84 200 84" fill="none" stroke="#fff" strokeWidth="2.5" />
        {[20, 40, 200, 220].map((x) => <circle key={x} cx={x} cy="84" r="4" fill="#0b0b0c" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />)}
        {[90, 120, 150].map((x) => <circle key={x} cx={x} cy="40" r="4" fill="#0b0b0c" stroke="#fff" strokeWidth="2" />)}
        <g className="dz-blink"><rect x="182" y="96" width="46" height="16" rx="4" fill="#fff" /><text x="205" y="107.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#0a0a0b">CI ✓</text></g>
      </>
    ),
  },
  {
    id: "mechanical", name: "Mechanical", line: "From CAD to the load test.", steps: ["CAD rev 4 + test rig", "Held 1.4 kN, no yield"],
    art: (
      <>
        <path className="dz-gear" d={gear(88, 60, 30, 12)} fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="88" cy="60" r="7" fill="none" stroke="#fff" strokeWidth="2" />
        <path className="dz-gear-back" d={gear(149, 60, 21, 9)} fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="149" cy="60" r="5" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
        <path d="M20 108 H220" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 4" />
      </>
    ),
  },
  {
    id: "electrical", name: "Electrical", line: "Board up, signal clean.", steps: ["PCB v2 brought up", "Scope capture, 0.4% ripple"],
    art: (
      <>
        {[30, 60, 90].map((y) => <path key={y} d={`M0 ${y} H240`} stroke="currentColor" strokeOpacity="0.12" />)}
        {[40, 80, 120, 160, 200].map((x) => <path key={x} d={`M${x} 10 V110`} stroke="currentColor" strokeOpacity="0.12" />)}
        <g className="dz-scroll"><polyline points={sine} fill="none" stroke="#fff" strokeWidth="2.5" /><polyline points={sine} transform="translate(360 0)" fill="none" stroke="#fff" strokeWidth="2.5" /></g>
      </>
    ),
  },
  {
    id: "aerospace", name: "Aerospace", line: "The static fire, with the data.", steps: ["Thrust curve logged", "1.2 kN peak, within 3%"],
    art: (
      <>
        <path d="M20 100 H225 M20 100 V15" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M20 40 H225" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
        <path className="dz-draw" d="M20 100 C40 100 45 30 62 30 C78 30 82 44 100 46 C130 49 150 50 170 56 C185 61 190 98 225 100" fill="none" stroke="#fff" strokeWidth="2.5" />
      </>
    ),
  },
  {
    id: "structures", name: "Structures", line: "Load it and measure it.", steps: ["Truss built to spec", "2.1 mm deflection at 500 N"],
    art: (
      <>
        <g className="dz-flex">
          <path d="M20 80 L60 40 L100 80 L140 40 L180 80 L220 40 M20 80 H220 M60 40 H220" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <path d="M120 8 V30 M114 24 L120 32 L126 24" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
        </g>
        <path d="M14 92 L26 92 L20 82 Z M208 92 L232 92" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeOpacity="0.35" />
      </>
    ),
  },
  {
    id: "biomedical", name: "Biomedical", line: "Protocol, results, sign-off.", steps: ["Sensor validated on 12 runs", "Matched reference ±2 bpm"],
    art: (
      <>
        <path d="M0 64 H240" stroke="currentColor" strokeOpacity="0.12" />
        <path className="dz-sweep" d="M0 64 H60 L70 64 L78 30 L88 96 L96 64 H150 L160 64 L168 30 L178 96 L186 64 H240" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      </>
    ),
  },
];

export function Disciplines() {
  return (
    <section id="disciplines" data-story="Every kind of engineering" className="story-sec relative isolate scroll-mt-24 overflow-x-clip py-24 sm:py-32">
      <Orb tone="mono" className="pointer-events-none absolute -top-10 -right-28 -z-10 size-72 opacity-95 sm:size-[26rem] lg:top-4 lg:right-[4%] lg:size-[30rem]" />
      <div className="mx-auto max-w-7xl px-6">
        <Head eyebrow="Every kind of engineering" title="Whatever you build," accent="it becomes proof." body="Code, CAD, circuits, rockets, bridges, devices: each kind of work has its own kind of evidence. Brazework records it as you go, and your club signs off on it." />
        <ul className="no-scrollbar mt-10 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-8 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {DISCIPLINES.map((d, i) => (
            <li key={d.id} className="w-[80%] shrink-0 snap-start sm:w-auto">
              <article className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#18181b,#0a0a0b_60%)] text-[#f4f4f5] shadow-[inset_0_1px_0_rgb(255_255_255/0.09),0_30px_60px_-34px_rgb(0_0_0/0.7)] transition duration-300 hover:border-white/25">
                <div className="relative h-36 overflow-hidden border-b border-white/[0.07]" aria-hidden="true">
                  {/* A dot grid fading out from the middle, and a black sphere catching the light at the corner. */}
                  <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.09)_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:radial-gradient(75%_80%_at_50%_45%,#000,transparent)]" />
                  <div className="absolute -top-14 -right-12 size-40 rounded-full bg-[radial-gradient(circle_at_34%_30%,#4a4a50,#1a1a1d_32%,#050506_72%)] shadow-[inset_-8px_-12px_24px_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]" />
                  <span className="absolute top-3 left-4 font-mono text-[11px] tracking-wider text-white/40">{String(i + 1).padStart(2, "0")}</span>
                  <svg viewBox="0 0 240 120" className="absolute inset-0 size-full text-white" preserveAspectRatio="xMidYMid meet">{d.art}</svg>
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-medium tracking-[0.14em] text-white/50 uppercase">{d.name}</p>
                  <h3 className="mt-2 text-[17px] font-semibold tracking-tight text-white">{d.line}</h3>
                  <ol className="mt-4 flex flex-col gap-2 text-sm text-white/70">
                    {d.steps.map((s, n) => <li key={s} className="flex items-center gap-2.5"><span className="font-mono text-[10px] text-white/35">0{n + 1}</span> {s}</li>)}
                  </ol>
                  <p className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-3.5 text-sm font-medium text-white"><BadgeCheck className="size-4 shrink-0" /> Verified by your club</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-faint sm:mt-2">Example results</p>
      </div>
    </section>
  );
}
