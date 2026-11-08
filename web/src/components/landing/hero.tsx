"use client";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { SparkField } from "./spark-field";
import { LiveFeedDemo } from "./live-feed-demo";

const delay = (d: number) => ({ "--delay": `${d}s` }) as CSSProperties;

const WHO = ["engineers", "physicists", "data scientists", "chemists", "mathematicians", "biologists", "builders"];

export function Hero() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % WHO.length), 2200);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <section ref={ref} id="top" className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40">
      {/* Atmosphere */}
      <div className="bg-blueprint absolute inset-0 -z-20" />
      <div className="absolute left-1/2 top-[-20%] -z-20 h-[720px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
      <SparkField className="absolute inset-0 -z-10 size-full" />

      <motion.div style={reduce ? undefined : { y, opacity: fade }} className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
        <div>
          <a href="#product" style={delay(0)} className="rise-in group glass inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-xs text-text-2 transition hover:border-line-strong">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-mono whitespace-nowrap text-[10px] tracking-wider text-accent uppercase">
              <Sparkles className="size-3" /> Early access
            </span>
            <span className="truncate">Now onboarding university STEM clubs</span>
            <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
          </a>

          <h1 style={delay(0)} className="focus-in mt-7 text-[clamp(2.6rem,5.6vw,4.6rem)] leading-[1] font-semibold tracking-[-0.045em]">
            Proof of work
            <br />
            <span className="text-shine">beats a résumé.</span>
          </h1>

          <p style={delay(0.1)} className="focus-in mt-7 max-w-xl text-lg leading-relaxed text-muted">
            Forge is where{" "}
            <span className="relative inline-grid overflow-hidden pb-[0.12em] align-[-0.32em] leading-[inherit] text-text">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={WHO[i]}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="col-start-1 row-start-1 font-medium whitespace-nowrap"
                >
                  {WHO[i]}
                </motion.span>
              </AnimatePresence>
            </span>{" "}
            show verified work instead of résumés. A home for your club, your projects, and the people who&apos;ll hire you. No recruiter spam. No AI slop. Just the work.
          </p>

          <div style={delay(0.28)} className="rise-in mt-9 flex flex-wrap items-center gap-3">
            <Button href="/signup" size="lg">
              Claim your profile
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Button>
            <Button href="#product" variant="outline" size="lg">See it live</Button>
          </div>
          <p style={delay(0.36)} className="rise-in mt-5 font-mono text-xs text-faint">
            Free for students &amp; professionals · Students verify with a university email
          </p>
        </div>

        <div className="rise-in" style={delay(0.25)}>
          <LiveFeedDemo />
        </div>
      </motion.div>
    </section>
  );
}
