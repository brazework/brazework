"use client";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { BadgeCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// Every kind of engineering (Linear FIX-92), as one spec sheet: a tab per field, then one large
// drawing that keeps moving (CSS only, stopped by the global reduced-motion rule) beside what
// Brazework records for that field. Black and white on both themes: the linework is the text colour.
// Wide screens tell it as a scroll story: the section is pinned and scrolling moves through the
// fields (the bar under the active tab is how far through this one you are; a tab scrolls to its
// field). Phones, where each section is one screen: fields advance on their own until someone picks
// one. Example results.

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
const faint = { stroke: "currentColor", strokeOpacity: 0.3 } as const;

const DISCIPLINES: Discipline[] = [
  {
    id: "software", name: "Software", line: "Ship it, and it's on the record.", steps: ["Pull request merged", "CI green on main"],
    art: (
      <>
        <path d="M10 84 H230" {...faint} strokeWidth="1.5" />
        <path className="dz-draw" d="M40 84 C60 84 60 40 90 40 H150 C180 40 180 84 200 84" fill="none" stroke="currentColor" strokeWidth="2" />
        {[20, 40, 200, 220].map((x) => <circle key={x} cx={x} cy="84" r="4" fill="var(--surface)" {...faint} strokeWidth="1.5" />)}
        {[90, 120, 150].map((x) => <circle key={x} cx={x} cy="40" r="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />)}
        <g className="dz-blink"><rect x="182" y="96" width="46" height="16" rx="4" fill="currentColor" /><text x="205" y="107.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--surface)">CI ✓</text></g>
      </>
    ),
  },
  {
    id: "mechanical", name: "Mechanical", line: "From CAD to the load test.", steps: ["CAD rev 4 + test rig", "Held 1.4 kN, no yield"],
    art: (
      <>
        <path className="dz-gear" d={gear(96, 60, 30, 12)} fill="none" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="96" cy="60" r="7" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path className="dz-gear-back" d={gear(157, 60, 21, 9)} fill="none" {...faint} strokeWidth="1.75" />
        <circle cx="157" cy="60" r="5" fill="none" {...faint} strokeWidth="1.75" />
        <path d="M20 108 H220" {...faint} strokeDasharray="3 4" />
      </>
    ),
  },
  {
    id: "electrical", name: "Electrical", line: "Board up, signal clean.", steps: ["PCB v2 brought up", "Scope capture, 0.4% ripple"],
    art: (
      <>
        {[30, 60, 90].map((y) => <path key={y} d={`M0 ${y} H240`} stroke="currentColor" strokeOpacity="0.1" />)}
        {[40, 80, 120, 160, 200].map((x) => <path key={x} d={`M${x} 10 V110`} stroke="currentColor" strokeOpacity="0.1" />)}
        <g className="dz-scroll"><polyline points={sine} fill="none" stroke="currentColor" strokeWidth="2" /><polyline points={sine} transform="translate(360 0)" fill="none" stroke="currentColor" strokeWidth="2" /></g>
      </>
    ),
  },
  {
    id: "aerospace", name: "Aerospace", line: "The static fire, with the data.", steps: ["Thrust curve logged", "1.2 kN peak, within 3%"],
    art: (
      <>
        <path d="M20 100 H225 M20 100 V15" {...faint} strokeWidth="1.25" />
        <path d="M20 40 H225" stroke="currentColor" strokeOpacity="0.12" strokeDasharray="4 4" />
        <path className="dz-draw" d="M20 100 C40 100 45 30 62 30 C78 30 82 44 100 46 C130 49 150 50 170 56 C185 61 190 98 225 100" fill="none" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  {
    id: "structures", name: "Structures", line: "Load it and measure it.", steps: ["Truss built to spec", "2.1 mm deflection at 500 N"],
    art: (
      <>
        <g className="dz-flex">
          <path d="M20 80 L60 40 L100 80 L140 40 L180 80 L220 40 M20 80 H220 M60 40 H220" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M120 8 V30 M114 24 L120 32 L126 24" fill="none" {...faint} strokeWidth="1.75" />
        </g>
        <path d="M14 92 L26 92 L20 82 Z M208 92 L232 92" fill="currentColor" fillOpacity="0.3" {...faint} />
      </>
    ),
  },
  {
    id: "biomedical", name: "Biomedical", line: "Protocol, results, sign-off.", steps: ["Sensor validated on 12 runs", "Matched reference ±2 bpm"],
    art: (
      <>
        <path d="M0 64 H240" stroke="currentColor" strokeOpacity="0.1" />
        <path className="dz-sweep" d="M0 64 H60 L70 64 L78 30 L88 96 L96 64 H150 L160 64 L168 30 L178 96 L186 64 H240" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
  },
];

export function DisciplineSheet() {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hold, setHold] = useState(false);
  const [wide, setWide] = useState(false);
  const [fill, setFill] = useState(0); // how far through the current field (wide screens)
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const playing = !wide && auto && !hold && !reduce && inView;
  const d = DISCIPLINES[at];
  const n = DISCIPLINES.length;
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // Wide screens: where you are in the (pinned, several-screens-tall) section picks the field.
  const section = () => ref.current?.closest("section") ?? null;
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", () => {
    const el = section();
    if (!wide || !el) return;
    const r = el.getBoundingClientRect();
    const v = Math.min(0.9999, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight))) * n;
    setAt(Math.floor(v));
    setFill(v - Math.floor(v));
  });
  const pick = (i: number) => {
    const el = section();
    if (!wide || !el) { setAuto(false); setAt(i); return; }
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * ((i + 0.08) / n), behavior: reduce ? "auto" : "smooth" });
  };

  // Phones: advance when the active tab's bar fills (it restarts on every change, and stops while held).
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setAt((v) => (v + 1) % n), 5000);
    return () => clearTimeout(t);
  }, [playing, at, n]);

  return (
    <div ref={ref} className="mt-10 md:mt-8" onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)} onPointerLeave={() => setHold(false)}>
      <div role="tablist" aria-label="Kinds of engineering" className="no-scrollbar -mx-6 flex gap-1 overflow-x-auto border-b border-line px-6 sm:mx-0 sm:px-0">
        {DISCIPLINES.map((x, i) => (
          <button key={x.id} type="button" role="tab" id={`dz-tab-${x.id}`} aria-selected={i === at} aria-controls="dz-panel"
            onClick={() => pick(i)}
            className={cn("relative shrink-0 px-3 pt-2 pb-3 text-sm font-medium transition", i === at ? "text-text" : "text-muted hover:text-text")}>
            {x.name}
            <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-px bg-line">
              {i === at && (
                <span key={`${at}-${playing}`} className="block h-full origin-left bg-text"
                  style={wide ? { transform: `scaleX(${Math.max(0.04, fill)})` } : playing ? { animation: "agent-fill 5s linear forwards" } : { transform: "scaleX(1)" }} />
              )}
            </span>
          </button>
        ))}
      </div>

      <div id="dz-panel" role="tabpanel" aria-labelledby={`dz-tab-${d.id}`}
        className="mt-6 grid overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* The drawing, on a dot grid, with corner ticks like a drafting sheet. */}
        <div className="relative h-48 border-b border-line bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[size:16px_16px] text-text sm:h-64 md:h-[min(20rem,42vh)] md:border-r md:border-b-0" aria-hidden="true">
          {["top-3 left-3 border-t border-l", "top-3 right-3 border-t border-r", "bottom-3 left-3 border-b border-l", "bottom-3 right-3 border-b border-r"].map((c) => (
            <span key={c} className={cn("absolute size-3 border-line-strong", c)} />
          ))}
          <span className="absolute bottom-3 left-7 font-mono text-[11px] text-faint">FIG. {String(at + 1).padStart(2, "0")} · {d.name.toUpperCase()}</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.svg key={d.id} viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet" className="absolute inset-x-6 inset-y-8 size-[calc(100%-3rem)] sm:inset-x-10 sm:size-[calc(100%-5rem)]"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {d.art}
            </motion.svg>
          </AnimatePresence>
        </div>

        <div className="flex flex-col justify-center p-5 sm:p-8" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{String(at + 1).padStart(2, "0")} / {String(DISCIPLINES.length).padStart(2, "0")} · {d.name}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{d.line}</h3>
              <ol className="mt-5 flex flex-col gap-2.5 text-[15px] text-text-2">
                {d.steps.map((s, n) => (
                  <li key={s} className="flex items-center gap-3"><span className="font-mono text-[11px] text-faint">0{n + 1}</span> {s}</li>
                ))}
              </ol>
              <p className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-[15px] font-medium"><BadgeCheck className="size-4 shrink-0" /> Verified by your club</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <p className="mt-3 text-xs text-faint">Example results</p>
    </div>
  );
}
