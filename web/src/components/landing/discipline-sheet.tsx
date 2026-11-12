"use client";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { BadgeCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// Every field in STEM (Linear FIX-92), as one spec sheet: a tab per field, then one large
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
const converge = Array.from({ length: 81 }, (_, i) => `${20 + i * 2.6},${(60 - 40 * Math.exp(-i / 22) * Math.cos(i / 3.2)).toFixed(1)}`).join(" ");
const titration = Array.from({ length: 61 }, (_, i) => { const x = i / 60; return `${20 + x * 205},${(100 - 80 / (1 + Math.exp(-(x - 0.55) * 26))).toFixed(1)}`; }).join(" ");
const loss = Array.from({ length: 61 }, (_, i) => `${22 + i * 3.4},${(22 + 70 * Math.exp(-i / 13) + (i % 3) * 1.4).toFixed(1)}`).join(" ");

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
    id: "biology", name: "Biology", line: "Run it, image it, run it again.", steps: ["Knockout confirmed on the gel", "Replicated in 3 of 3 runs"],
    art: (
      <>
        {[40, 80, 120, 160, 200].map((x) => <rect key={x} x={x - 14} y="14" width="28" height="92" rx="2" fill="none" {...faint} strokeWidth="1.25" />)}
        {[22, 36, 52, 70, 90].map((y) => <rect key={y} x="30" y={y} width="20" height="3" rx="1" fill="currentColor" fillOpacity="0.45" />)}
        {[[80, 44], [120, 44], [160, 44], [200, 70]].map(([x, y], i) => (
          <rect key={x} className="dz-blink" style={{ animationDelay: `${i * 0.5}s` }} x={x - 10} y={y} width="20" height="4" rx="1" fill="currentColor" />
        ))}
      </>
    ),
  },
  {
    id: "chemistry", name: "Chemistry", line: "Every titration, on the record.", steps: ["Equivalence point at 24.6 mL", "Within 1.2% of theory"],
    art: (
      <>
        <path d="M20 100 H225 M20 100 V15" {...faint} strokeWidth="1.25" />
        <path d="M133 15 V100" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
        <polyline className="dz-draw" points={titration} fill="none" stroke="currentColor" strokeWidth="2" />
        <circle className="dz-blink" cx="133" cy="60" r="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  },
  {
    id: "physics", name: "Physics", line: "Measure it, then measure it again.", steps: ["g = 9.79 m/s² from 40 swings", "Error bars in the write-up"],
    art: (
      <>
        <path d="M70 12 H170" stroke="currentColor" strokeWidth="1.75" />
        <g className="dz-swing" style={{ transformOrigin: "120px 12px" }}>
          <path d="M120 12 V88" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="120" cy="96" r="9" fill="var(--surface)" stroke="currentColor" strokeWidth="1.75" />
        </g>
        <path d="M78 104 Q120 116 162 104" fill="none" {...faint} strokeDasharray="3 4" />
      </>
    ),
  },
  {
    id: "data", name: "Data & AI", line: "Show the model and the work behind it.", steps: ["Trained on 18k labelled images", "94% on a held-out set"],
    art: (
      <>
        <path d="M20 100 H225 M20 100 V15" {...faint} strokeWidth="1.25" />
        <polyline className="dz-draw" points={loss} fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 30 H225" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4" />
        <g className="dz-blink"><rect x="168" y="8" width="56" height="16" rx="4" fill="currentColor" /><text x="196" y="19.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--surface)">val 94%</text></g>
      </>
    ),
  },
  {
    id: "math", name: "Math", line: "Proofs that hold up.", steps: ["Convergence proof written up", "Formalised in Lean 4"],
    art: (
      <>
        <path d="M20 60 H230" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="4 4" />
        <text x="232" y="56" fontSize="10" fill="currentColor" fillOpacity="0.5" textAnchor="end">L</text>
        <polyline className="dz-draw" points={converge} fill="none" stroke="currentColor" strokeWidth="2" />
        <text className="dz-blink" x="226" y="104" fontSize="14" fill="currentColor" textAnchor="end">∎</text>
      </>
    ),
  },
];

export function DisciplineSheet({ head }: { head: React.ReactNode }) {
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
    <div ref={ref} onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)} onPointerLeave={() => setHold(false)}
      className="grid grid-cols-1 gap-y-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-x-14 md:gap-y-7">
      {/* Wide screens: the heading, the fields and what this one records on the left; the drawing on the right. */}
      <div className="md:col-start-1">{head}</div>

      <div role="tablist" aria-label="Fields in STEM" className="no-scrollbar -mx-6 flex gap-1 overflow-x-auto border-b border-line px-6 md:col-start-1 md:mx-0 md:flex-wrap md:px-0">
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

      {/* The drawing, on a dot grid, with corner ticks like a drafting sheet. */}
      <div className="relative h-48 overflow-hidden rounded-2xl border border-line bg-surface bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[size:16px_16px] text-text shadow-[var(--shadow)] sm:h-64 md:col-start-2 md:row-span-3 md:row-start-1 md:h-[min(34rem,64vh)] md:self-center" aria-hidden="true">
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

      <div id="dz-panel" role="tabpanel" aria-labelledby={`dz-tab-${d.id}`} aria-live="polite" className="md:col-start-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{String(at + 1).padStart(2, "0")} / {String(DISCIPLINES.length).padStart(2, "0")} · {d.name} · example</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{d.line}</h3>
            <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-text-2">
              {d.steps.map((s, n) => (
                <li key={s} className="flex items-center gap-2"><span className="font-mono text-[11px] text-faint">0{n + 1}</span> {s}</li>
              ))}
              <li className="flex items-center gap-2 font-medium text-text"><BadgeCheck className="size-4 shrink-0" /> Verified by your club</li>
            </ol>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
