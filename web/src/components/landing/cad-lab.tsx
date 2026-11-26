"use client";
import { BadgeCheck, Box, Gauge, Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import type { BuildId } from "./cad/models";
import type { Lab, Mode } from "./cad/engine";

// The landing page's CAD lab (redesign 2026-11): real builds, the way their makers see them in CAD.
// Pick a build, cut it open, or look at where it's loaded; the trace underneath is what it measured.
// Each one carries the signed milestone it led to. Examples, and the page says so.
// three.js (cad/engine.ts) loads only when the lab is about to scroll into view. Where WebGL can't
// start, the same build shows as its spec sheet, so the section never comes up empty.

type Spec = { label: string; value: string };
type BuildInfo = {
  id: BuildId; tab: string; name: string; field: string;
  callouts: Record<string, string>;
  specs: Spec[];
  trace: { label: string; unit: string; f: (t: number) => number; min: number; max: number };
  milestone: string; by: string; as: string;
};

const BUILDS: BuildInfo[] = [
  {
    id: "avionics", tab: "Avionics bay", name: "Dual-deploy flight computer", field: "Aerospace",
    callouts: { imu: "IMU + baro · 200 Hz", pyro: "Drogue / main pyro", frame: "Ø98 mm carbon airframe" },
    specs: [{ label: "Logging", value: "200 Hz" }, { label: "Apogee", value: "1,140 m" }, { label: "Mass", value: "412 g" }],
    // A boost, burnout, coast, then the drogue's jolt at apogee.
    trace: { label: "Axial acceleration", unit: "g", min: -2, max: 12, f: (t) => { const s = t % 14; return s < 1.6 ? 10.5 * Math.sin((s / 1.6) * Math.PI * 0.55) + Math.sin(s * 40) * 0.35 : s < 9 ? -1 + Math.exp(-(s - 1.6)) * 0.3 : s < 9.4 ? 6 * Math.exp(-(s - 9) * 6) : 0.1 * Math.sin(s * 5); } },
    milestone: "Level 1 flight: 1,140 m apogee, both charges fired on time, recovered intact", by: "J. Reyes", as: "certification prefect, Tripoli",
  },
  {
    id: "arm", tab: "6-axis arm", name: "Benchtop cobot arm", field: "Robotics",
    callouts: { j2: "J2 · 38 N·m peak", elbow: "Harmonic drive · 100:1", grip: "±0.05 mm · 3 kg" },
    specs: [{ label: "Reach", value: "620 mm" }, { label: "Payload", value: "3 kg" }, { label: "Cycle", value: "7.1 s" }],
    trace: { label: "J2 torque", unit: "N·m", min: 0, max: 45, f: (t) => 22 + 12 * Math.sin(t * 0.47 + 0.4) + 2.5 * Math.sin(t * 3.1) + (Math.sin(t * 1.2) > 0.96 ? 6 : 0) },
    milestone: "Cut the pick-and-place cycle from 9.4 to 7.1 seconds over 500 runs", by: "Dana R.", as: "test lead, Voltline (coworker)",
  },
  {
    id: "gearbox", tab: "Planetary gearbox", name: "5:1 planetary reduction", field: "Mechanical",
    callouts: { ratio: "Carrier · 5:1", tooth: "Module 1.0 · 20° PA", shaft: "40 N·m output" },
    specs: [{ label: "Ratio", value: "5 : 1" }, { label: "Efficiency", value: "96%" }, { label: "Backlash", value: "8 arcmin" }],
    trace: { label: "Case temperature", unit: "°C", min: 20, max: 60, f: (t) => 24 + 24 * (1 - Math.exp(-(t % 30) / 9)) + 0.6 * Math.sin(t * 2.3) },
    milestone: "Ran 2 hours at 40 N·m with no slip and the case under 50 °C", by: "Prof. Alvarez", as: "Machine Design (professor)",
  },
];

const MODES: { id: Mode; label: string; icon: typeof Box }[] = [
  { id: "render", label: "Render", icon: Box },
  { id: "section", label: "Section", icon: Scissors },
  { id: "stress", label: "Stress", icon: Gauge },
];

export function CadLab() {
  const [build, setBuild] = useState<BuildId>("avionics");
  const [mode, setMode] = useState<Mode>("render");
  const [state, setState] = useState<"waiting" | "ready" | "failed">("waiting");
  const host = useRef<HTMLDivElement>(null);
  const lab = useRef<Lab | null>(null);
  const callouts = useRef<Record<string, HTMLDivElement | null>>({});
  const path = useRef<SVGPathElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const info = BUILDS.find((b) => b.id === build)!;
  const infoRef = useRef(info);
  useEffect(() => { infoRef.current = info; }, [info]);

  // Load three.js and start the stage once the lab is near the screen.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const samples: number[] = [];
    const draw = (t: number) => {
      const tr = infoRef.current.trace;
      samples.push(tr.f(t));
      if (samples.length > 160) samples.shift();
      const d = samples.map((y, i) => `${i ? "L" : "M"}${(i / 159) * 100},${(36 - ((y - tr.min) / (tr.max - tr.min)) * 32).toFixed(2)}`).join("");
      path.current?.setAttribute("d", d);
      if (readout.current) readout.current.textContent = `${tr.f(t).toFixed(1)} ${tr.unit}`;
    };
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || lab.current) return;
      io.disconnect();
      try {
        const { createLab } = await import("./cad/engine");
        if (gone) return;
        lab.current = createLab(el, {
          build, mode, still,
          dark: true,
          place: (id, x, y, show, right) => {
            const c = callouts.current[id];
            if (!c) return;
            c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            c.style.opacity = show ? "1" : "0";
            // Labels lead away from the middle, so two on one part don't land on each other, unless
            // that side has no room for the label (a phone): then they lead back across the stage.
            const room = 190, width = host.current?.clientWidth ?? 0;
            const side = x < room ? "r" : x > width - room ? "l" : right ? "r" : "l";
            if (c.dataset.side !== side) c.dataset.side = side;
          },
          onTime: draw,
        });
        if (still) for (let i = 0; i < 160; i++) draw(i * 0.09);
        setState("ready");
      } catch {
        if (!gone) setState("failed");
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => { gone = true; io.disconnect(); lab.current?.dispose(); lab.current = null; };
    // The stage starts once with the current build and mode; later changes go through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { lab.current?.setBuild(build); }, [build]);
  useEffect(() => { lab.current?.setMode(mode); }, [mode]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-float)]">
      {/* The toolbar: which build, and how to look at it. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <div role="tablist" aria-label="Example builds" className="no-scrollbar -mx-1 flex min-w-0 flex-1 basis-full gap-1 overflow-x-auto px-1 sm:basis-auto">
          {BUILDS.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={b.id === build} aria-controls="cad-stage" onClick={() => setBuild(b.id)}
              className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors", b.id === build ? "bg-raised font-medium text-text" : "text-muted hover:bg-hover hover:text-text")}>
              {b.tab}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="View" className="flex shrink-0 rounded-lg border border-line p-0.5 max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors", mode === m.id ? "bg-accent text-on-accent" : "text-muted hover:text-text")}>
              <m.icon className="size-3.5" aria-hidden="true" /> {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* The stage: a drawing sheet under the model, callouts that follow their parts. */}
        <div id="cad-stage" data-state={state} role="tabpanel" aria-label={`${info.name}, ${MODES.find((m) => m.id === mode)!.label.toLowerCase()} view`} className="cad-sheet relative aspect-[4/5] min-h-0 overflow-hidden sm:aspect-[16/11]">
          <div ref={host} className={cn("absolute inset-0 transition-opacity duration-500", state === "ready" ? "opacity-100" : "opacity-0")} />
          {state !== "ready" && (
            <div className="absolute inset-0 grid place-items-center" aria-hidden={state === "waiting"}>
              {state === "failed"
                ? <p className="max-w-xs px-6 text-center text-sm text-muted">This browser can&apos;t draw 3D right now. The spec sheet beside it has the numbers.</p>
                : <div className="cad-scan h-px w-2/3" />}
            </div>
          )}
          {state === "ready" && Object.entries(info.callouts).map(([id, text]) => (
            <div key={`${build}-${id}`} ref={(el) => { callouts.current[id] = el; }} data-side="r" className="cad-callout pointer-events-none absolute top-0 left-0 opacity-0 transition-opacity duration-300" aria-hidden="true">
              <span className="block size-2 -translate-x-1 -translate-y-1 rounded-full border-2 border-brand bg-surface" />
              <span className="cad-leader absolute top-[-1px] h-px w-9 bg-brand/70" />
              <span className="cad-tag absolute top-[-24px] rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-[11px] whitespace-nowrap text-text shadow-[var(--shadow)] backdrop-blur-sm">{text}</span>
            </div>
          ))}
          {mode === "stress" && state === "ready" && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur-sm">
              <span>Low</span><span className="h-1.5 w-20 rounded-full" style={{ background: "linear-gradient(90deg,#30123b,#4686fb,#1ae4b6,#a2fc3c,#fabb39,#e4460a,#7a0403)" }} /><span>High</span>
            </div>
          )}
          <p className="absolute right-3 bottom-3 hidden font-mono text-[10px] text-faint sm:block">Drag to turn</p>
        </div>

        {/* The spec sheet: what it is, the numbers, the live trace, and who signed the result. */}
        <aside aria-label="Spec sheet" className="flex flex-col border-t border-line lg:border-t-0 lg:border-l">
          <div className="px-4 pt-4 sm:px-5">
            <p className="font-mono text-[11px] text-faint">{info.field}</p>
            <h3 className="mt-1 text-lg leading-snug font-semibold tracking-tight">{info.name}</h3>
          </div>
          <dl className="mt-4 grid grid-cols-3 border-y border-line">
            {info.specs.map((s, i) => (
              <div key={s.label} className={cn("px-4 py-3 sm:px-5", i > 0 && "border-l border-line")}>
                <dt className="text-[11px] text-faint">{s.label}</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="px-4 py-4 sm:px-5">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-faint">{info.trace.label}</span>
              <span ref={readout} className="font-mono text-text-2 tabular-nums">—</span>
            </div>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-2 h-16 w-full" aria-hidden="true">
              <path d="M0,10H100M0,20H100M0,30H100" stroke="var(--border)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" fill="none" />
              <path ref={path} d="" stroke="var(--brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" fill="none" strokeLinejoin="round" />
            </svg>
          </div>
          <figure className="mt-auto border-t border-line px-4 py-4 sm:px-5">
            <blockquote className="text-sm leading-snug font-medium text-pretty">{info.milestone}</blockquote>
            <figcaption className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden="true" />
              <span>Signed by <span className="font-medium text-text-2">{info.by}</span>, {info.as}</span>
            </figcaption>
          </figure>
        </aside>
      </div>
    </div>
  );
}
