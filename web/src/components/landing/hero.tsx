"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Box, FileText, Gauge, Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Seal } from "@/components/app/verified-seal";
import { Button } from "@/components/ui";
import { cleanBuild, signupHref } from "@/lib/front-door";
import { cn } from "@/lib/forge";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { CadStage, type BuildId, type Mode } from "./cad-stage";

// The hero (redesign 2026-11; schools first since 2026-11-26): the whole product in one screen, to
// play with. On the left, one line and one box: what did you build? On the right, a real build in
// CAD (turn it, cut it open, see where it's loaded) with your milestone docked on it, as a class or
// club project. What you type becomes the milestone, and pressing Sign does what the professor or
// club officer who saw it would: their seal comes down and it's on your record, with the class and
// the semester. The button carries what you typed into sign-up (?build=, lib/front-door.ts).
// Examples, and it says so.

type Example = { id: BuildId; chip: string; where: string; name: string; milestone: string; proof: string; signer: string; role: string; callouts: Record<string, string> };
const EXAMPLES: Example[] = [
  { id: "avionics", chip: "Rocket avionics", where: "Club project · Rocketry Club", name: "Dual-deploy flight computer", milestone: "Level 1 flight: 1,140 m apogee, both charges fired on time", proof: "flight-log-0412.csv", signer: "J. Reyes", role: "safety officer, Rocketry Club", callouts: { imu: "IMU + baro · 200 Hz", pyro: "Drogue / main pyro", frame: "Ø98 mm carbon airframe" } },
  { id: "arm", chip: "Robot arm", where: "Class project · ME 482 Robotics · Fall 2026", name: "Benchtop cobot arm", milestone: "Cut the pick-and-place cycle from 9.4 to 7.1 seconds", proof: "cycle-test-500-runs.csv", signer: "Prof. Dana Ruiz", role: "ME 482, Fall 2026", callouts: { j2: "J2 · 38 N·m peak", elbow: "Harmonic drive · 100:1", grip: "±0.05 mm · 3 kg" } },
  { id: "gearbox", chip: "Gearbox", where: "Class project · ME 410 Capstone · Fall 2026", name: "5:1 planetary reduction", milestone: "Ran 2 hours at 40 N·m with no slip, case under 50 °C", proof: "dyno-run-2h.mp4", signer: "Prof. Alvarez", role: "ME 410 Capstone, Fall 2026", callouts: { ratio: "Carrier · 5:1", tooth: "Module 1.0 · 20° PA", shaft: "40 N·m output" } },
];
const MODES: { id: Mode; label: string; icon: typeof Box }[] = [
  { id: "render", label: "Render", icon: Box },
  { id: "section", label: "Section", icon: Scissors },
  { id: "stress", label: "Stress", icon: Gauge },
];

export function Hero() {
  const [typed, setTyped] = useState("");
  const [pick, setPick] = useState<BuildId>("avionics");
  const [mode, setMode] = useState<Mode>("render");
  const [signed, setSigned] = useState(false);
  const still = useReducedMotion();
  const touched = useRef(false);
  const ex = EXAMPLES.find((e) => e.id === pick)!;
  const build = cleanBuild(typed);
  const title = build || ex.milestone;

  // The first example signs itself a moment after the page opens (unless the visitor got there
  // first), so a visitor who only watches still sees the whole idea. With reduced motion it's signed.
  useEffect(() => {
    const t = window.setTimeout(() => { if (!touched.current) setSigned(true); }, still ? 0 : 3200);
    return () => window.clearTimeout(t);
  }, [still]);
  const choose = (id: BuildId) => { touched.current = true; setPick(id); setSigned(false); };

  return (
    <section id="top" aria-labelledby="hero-h" className="theme-dark relative isolate overflow-hidden bg-bg pt-24 pb-12 text-text sm:pt-28 lg:pb-16">
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-text-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-brand" /> Free with your school email</p>
          <h1 id="hero-h" className="mt-5 text-[clamp(2.75rem,6.4vw,4.75rem)] leading-[0.95] font-semibold tracking-[-0.05em]">Prove what<br />you built.</h1>
          <p className="mt-5 max-w-[30rem] text-lg leading-relaxed text-muted">Your class and club projects, verified by the professor or club that saw the work. A record that counts for your school, and that you keep when you graduate.</p>

          <div className="mt-8 max-w-[30rem]">
            <label htmlFor="hero-build" className="text-sm font-medium text-text-2">What did you build?</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input id="hero-build" value={typed} maxLength={300} autoComplete="off" enterKeyHint="go"
                onChange={(e) => { touched.current = true; setTyped(e.target.value); setSigned(false); }}
                onKeyDown={(e) => { if (e.key === "Enter" && build) window.location.assign(signupHref("", build)); }}
                placeholder={ex.milestone} aria-describedby="hero-build-hint" aria-controls="hero-card"
                className="h-12 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-4 text-[16px] transition outline-none placeholder:text-faint focus:border-text focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_12%,transparent)]" />
              <Button href={signupHref("", typed)} size="lg" className="h-12 shrink-0 rounded-xl px-5">Get it signed <ArrowRight className="size-4" /></Button>
            </div>
            <p id="hero-build-hint" className="mt-2.5 text-sm text-faint">Type it and watch it land on the card. A free account keeps it.</p>
          </div>
        </div>

        {/* The build, and your milestone on it. */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-float)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
              <div role="group" aria-label="Example builds" className="no-scrollbar -mx-1 flex min-w-0 flex-1 basis-full gap-1 overflow-x-auto px-1 sm:basis-auto">
                {EXAMPLES.map((e) => (
                  <button key={e.id} type="button" aria-pressed={e.id === pick} onClick={() => choose(e.id)}
                    className={cn("inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm whitespace-nowrap transition-colors", e.id === pick ? "bg-raised font-medium text-text" : "text-muted hover:bg-hover hover:text-text")}>
                    {e.chip}
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
            <CadStage build={pick} mode={mode} callouts={ex.callouts} className="aspect-[5/4] sm:aspect-[16/11]">
              {mode === "stress" && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur-sm">
                  <span>Low</span><span className="h-1.5 w-16 rounded-full" style={{ background: "linear-gradient(90deg,#30123b,#4686fb,#1ae4b6,#a2fc3c,#fabb39,#e4460a,#7a0403)" }} /><span>High</span>
                </div>
              )}
              <p aria-hidden="true" className="absolute top-3 right-3 hidden font-mono text-[10px] text-faint sm:block">Drag to turn</p>
            </CadStage>

            {/* Your milestone: what you typed, its proof, and who it's waiting for, until they sign. */}
            <div id="hero-card" aria-live="polite" className="border-t border-line px-4 py-4 sm:px-5">
              <p className="truncate font-mono text-[11px] text-faint">{ex.where} · {ex.name}</p>
              <p className="mt-1.5 line-clamp-2 min-h-[2.75em] text-[15px] leading-snug font-semibold text-pretty break-words">{title}</p>
              <div className="mt-3 flex flex-col items-start gap-2 sm:min-h-9 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted"><FileText className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{ex.proof}</span></span>
                <AnimatePresence mode="wait" initial={false}>
                  {signed ? (
                    <motion.span key="signed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex min-h-8 items-center gap-2 text-xs text-text-2">
                      <span className="seal-stamp inline-grid"><Seal size={22} /></span>
                      <span>Signed by <span className="font-medium text-text">{ex.signer}</span>, {ex.role}</span>
                    </motion.span>
                  ) : (
                    <motion.span key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex min-h-8 items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted"><span aria-hidden="true" className="block size-3.5 rounded-full border-2 border-dashed border-wait" /> Waiting for {ex.signer}</span>
                      <button type="button" onClick={() => { touched.current = true; setSigned(true); }} className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent transition active:scale-95">Sign as {ex.signer}</button>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-faint">Example builds and people, to show how a signed milestone reads.</p>
        </div>
      </div>
    </section>
  );
}
