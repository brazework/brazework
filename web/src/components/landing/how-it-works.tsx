"use client";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Seal } from "@/components/app/verified-seal";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";
import { SwipeControls } from "./swipe-controls";

// How it works, straight after the hero (Linear FIX-218): the whole product in three steps, for the
// visitor who won't watch the hero's demo play. One example entry is shown three times, once per
// step: logged with its proof, waiting for a signature (dashed amber), signed (the green seal). It is
// the same picture as the launch film, and the same colours the app uses for those states.
//
// On wider screens, the line joining the steps is tied to the scroll: it draws as the section moves up the screen, and
// each step's state appears when the line reaches it (and goes again if you scroll back). Nothing
// here is dimmed while it waits, so the words read at full contrast from the first paint; only the
// state under each step and the ink on its number change. With reduced motion, and before the page's
// script runs, all three are simply shown.

const WORK = "Cut the pick-and-place cycle from 9.4 to 7.1 seconds";
const STEPS = [
  { title: "Log what you finished", body: "One sentence, plus a link or a file that shows it: a pull request, a test log, a photo." },
  { title: "Ask someone who saw it", body: "Your coworker, professor, client or club gets one email and signs in under a minute. They don't need an account." },
  { title: "It's on your record", body: "With their name on it. Share it, put it on a résumé, and keep it when you graduate or change jobs." },
];
// Where along the line each step sits (the start of its column).
const AT = [0.02, 0.36, 0.7];

export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const still = useReducedMotion();
  // From the steps entering the lower part of the screen to their end passing its middle.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.6"] });
  const [reached, setReached] = useState(3);
  const count = (v: number) => AT.filter((a) => v >= a).length;
  useMotionValueEvent(scrollYProgress, "change", (v) => { if (!still) setReached(count(v)); });
  // Once the page has laid out: where it already is (a fresh load at the top, a reload half-way down,
  // a link to #how). Until then, and with no script at all, the three states are shown.
  useEffect(() => {
    if (still) return;
    const id = requestAnimationFrame(() => setReached(AT.filter((a) => scrollYProgress.get() >= a).length));
    return () => cancelAnimationFrame(id);
  }, [still, scrollYProgress]);

  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20 border-y border-line bg-surface-2/60 py-12 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="how-h" className={H2}>Log it. Get it signed. Keep it.</h2>
        <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-muted">That&apos;s the whole idea, whether you&apos;re in school or at work. It takes a few minutes, and it&apos;s free for everyone who builds.</p>

        <SwipeControls rowId="landing-steps" count={STEPS.length} hint="Swipe through the steps" />
        <div className="relative mt-2 md:mt-12">
          <span aria-hidden="true" className="absolute top-4 right-0 left-0 hidden h-px bg-line-strong md:block" />
          <motion.span aria-hidden="true" className="absolute top-4 right-0 left-0 hidden h-px origin-left bg-text md:block" style={{ scaleX: still ? 1 : scrollYProgress }} />
          <ol id="landing-steps" ref={ref} aria-label="How it works" tabIndex={0} className="landing-swipe-row relative grid grid-cols-1 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => {
              const on = reached > i;
              return (
                <li key={s.title} className="relative rounded-2xl border border-line bg-surface p-4 pt-14 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:pt-14">
                  <span className={cn("absolute top-4 left-4 grid size-8 md:top-0 md:left-0 place-items-center rounded-full border text-sm font-semibold tabular-nums transition-colors duration-300", on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-text-2")}>{i + 1}</span>
                  <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
                  <figure className={cn("mt-5 rounded-xl border bg-surface px-4 py-3.5 transition-colors duration-300", i === 1 ? cn("border-dashed border-wait", !on && "md:border-solid md:border-line") : i === 2 ? cn("border-ok", !on && "md:border-line") : "border-line")}>
                    <p className="text-sm leading-snug font-medium">{WORK}</p>
                    {/* Kept in the layout while it waits, so nothing below moves when it appears. */}
                    <figcaption className={cn("mt-2.5 flex min-h-9 items-center gap-2 text-xs leading-snug text-muted transition-opacity duration-300", !on && "md:invisible md:opacity-0")}>
                      {i === 0 && <><FileText className="size-4 shrink-0" aria-hidden="true" /><span>Logged, with <span className="font-medium text-text-2">cycle-test-log.csv</span> as proof</span></>}
                      {i === 1 && <><span aria-hidden="true" className="block size-4 shrink-0 rounded-full border-2 border-dashed border-wait" /><span>Waiting for <span className="font-medium text-text-2">Dana R.</span>, engineering coworker</span></>}
                      {i === 2 && <><Seal size={18} /><span>Signed by <span className="font-medium text-text-2">Dana R.</span>, coworker at Voltline</span></>}
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button href="/signup" size="lg" className="h-12 rounded-xl px-5">Create your free account</Button>
        </div>
        <p className="mt-4 text-xs text-faint">An example, to show how an entry reads at each step.</p>
      </div>
    </section>
  );
}
