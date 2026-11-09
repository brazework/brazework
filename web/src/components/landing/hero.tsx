"use client";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { ProfileCard } from "./profile-card";
import { PROFESSIONS } from "./professions";

// The hero: pick a profession (or watch them cycle) and see the Forge profile you'd build.
// Cycling is driven by the active chip's progress bar ending (onAnimationEnd), so the bar and
// the switch can never drift apart, and pausing is just pausing the CSS animation.
export function Hero() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const p = PROFESSIONS[i];
  const cycling = auto && !reduce;

  // A gentle 3D tilt that follows the cursor over the card stack.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 160, damping: 18 });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 160, damping: 18 });

  const pick = (n: number) => { setAuto(false); setI(n); };

  return (
    <section id="top" className="relative isolate overflow-hidden pt-32 pb-20 sm:pt-40">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl transition-[background] duration-700" style={{ background: p.grad }} />
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
        <div>
          <a href="#founding" className="rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-text-2 shadow-sm transition hover:border-line-strong">
            <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" /><span className="relative size-2 rounded-full bg-ok" /></span>
            <span className="truncate">Founding clubs program is open</span>
            <ArrowRight className="size-3.5 shrink-0" />
          </a>
          <h1 className="focus-in mt-7 text-[clamp(2.6rem,6vw,4.75rem)] leading-[1] font-semibold tracking-[-0.045em]">
            Where
            <br />
            <span className="relative inline-grid align-bottom">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={p.id}
                  initial={{ y: "60%", opacity: 0, filter: "blur(6px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "-60%", opacity: 0, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-clip-text pb-1 text-transparent"
                  style={{ backgroundImage: p.grad }}
                >
                  {p.who}
                </motion.span>
              </AnimatePresence>
            </span>
            <br />
            get found.
          </h1>
          <p className="focus-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ ["--delay" as string]: "0.1s" }}>
            Forge is home base for university STEM clubs. Talk, plan and build together in one place, and every result your club verifies becomes proof that gets you hired. Ember, your AI teammate, handles the busywork.
          </p>

          <div className="rise-in mt-8" style={{ ["--delay" as string]: "0.2s" }}>
            <div className="mb-2 text-xs font-medium text-faint">Pick your field</div>
            <div role="tablist" aria-label="Professions" className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {PROFESSIONS.map((x, n) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={n === i}
                  aria-controls="hero-profile"
                  onClick={() => pick(n)}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full border px-3.5 py-1.5 text-sm transition",
                    n === i ? "border-text bg-text text-bg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                  )}
                >
                  <x.icon className="size-4" /> {x.short}
                  {n === i && cycling && (
                    <span
                      key={`bar-${i}`}
                      className="hero-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-bg/60"
                      style={{ animationPlayState: paused ? "paused" : "running" }}
                      onAnimationEnd={() => setI((v) => (v + 1) % PROFESSIONS.length)}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rise-in mt-9 flex flex-wrap items-center gap-3" style={{ ["--delay" as string]: "0.3s" }}>
            <Button href="/signup" size="lg">Create your profile <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Button>
            <Button href="#founding" variant="outline" size="lg">Bring your club</Button>
          </div>
          <p className="rise-in mt-4 text-sm text-faint" style={{ ["--delay" as string]: "0.35s" }}>Free for students and clubs · University email verified</p>
        </div>

        <div
          className="relative mx-auto w-full max-w-[420px] [perspective:1200px]"
          onPointerMove={(e) => {
            if (reduce) return;
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width - 0.5);
            my.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => { mx.set(0); my.set(0); setPaused(false); }}
        >
          <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="relative">
            {/* The next two professions peek out behind, so it reads as a deck you can flip through. */}
            {[2, 1].map((k) => {
              const q = PROFESSIONS[(i + k) % PROFESSIONS.length];
              return (
                <button
                  key={k}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => pick((i + k) % PROFESSIONS.length)}
                  className="absolute inset-x-6 top-0 h-full rounded-3xl border border-line bg-surface shadow-lg transition-all duration-500"
                  style={{ transform: `translateY(${-k * 18}px) scale(${1 - k * 0.06})`, opacity: 1 - k * 0.2 }}
                >
                  <span className="block h-24 rounded-t-3xl" style={{ background: q.grad }} />
                </button>
              );
            })}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={p.id}
                id="hero-profile"
                role="tabpanel"
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.98, rotate: -3 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <ProfileCard p={p} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
