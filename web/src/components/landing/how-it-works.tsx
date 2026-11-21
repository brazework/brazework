"use client";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Seal } from "@/components/app/verified-seal";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { H2 } from "./sections";

// How it works, straight after the hero (Linear FIX-218): the whole product in three steps, for the
// visitor who won't watch the hero's demo play. One example entry is shown three times, once per
// step: logged with its proof, waiting for a signature (dashed amber), signed (the green seal). It is
// the same picture as the launch film, and the same colours the app uses for those states.
//
// The line joining the steps is tied to the scroll: it draws as the section moves up the screen, and
// each step's state appears when the line reaches it (and goes again if you scroll back). Nothing
// here is dimmed while it waits, so the words read at full contrast from the first paint; only the
// state under each step and the ink on its number change. With reduced motion, and before the page's
// script runs, all three are simply shown.

const WORK = "Cut the pick-and-place cycle from 9.4 to 7.1 seconds";
const STEPS = [
  { title: "Log what you finished", body: "One sentence, plus a link or a file that shows it: a pull request, a test log, a photo." },
  { title: "Ask someone who saw it", body: "Your manager, professor, client or club gets one email and signs in under a minute. They don't need an account." },
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
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20 border-y border-line bg-surface-2/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="how-h" className={H2}>Log it. Get it signed. Keep it.</h2>
        <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-muted">That&apos;s the whole idea, whether you&apos;re in school or at work. It takes a few minutes, and it&apos;s free for everyone who builds.</p>

        <ol ref={ref} className="relative mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {/* The line: down the left on a phone, across the top on a laptop. */}
          <span aria-hidden="true" className="absolute top-4 bottom-4 left-4 w-px bg-line-strong md:top-4 md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto" />
          <motion.span aria-hidden="true" className="absolute top-4 bottom-4 left-4 w-px origin-top bg-text md:hidden" style={{ scaleY: still ? 1 : scrollYProgress }} />
          <motion.span aria-hidden="true" className="absolute top-4 right-0 left-0 hidden h-px origin-left bg-text md:block" style={{ scaleX: still ? 1 : scrollYProgress }} />

          {STEPS.map((s, i) => {
            const on = reached > i;
            return (
              <li key={s.title} className="relative pl-14 md:pt-14 md:pl-0">
                <span className={cn("absolute top-0 left-0 grid size-8 place-items-center rounded-full border text-sm font-semibold tabular-nums transition-colors duration-300", on ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-text-2")}>{i + 1}</span>
                <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
                <figure className={cn("mt-5 rounded-xl border bg-surface px-4 py-3.5 transition-colors duration-300", on && i === 1 ? "border-dashed border-wait" : on && i === 2 ? "border-ok" : "border-line")}>
                  <p className="text-sm leading-snug font-medium">{WORK}</p>
                  {/* Kept in the layout while it waits, so nothing below moves when it appears. */}
                  <figcaption className={cn("mt-2.5 flex min-h-9 items-center gap-2 text-xs leading-snug text-muted transition-opacity duration-300", on ? "opacity-100" : "invisible opacity-0")}>
                    {i === 0 && <><FileText className="size-4 shrink-0" aria-hidden="true" /><span>Logged, with <span className="font-medium text-text-2">cycle-test-log.csv</span> as proof</span></>}
                    {i === 1 && <><span aria-hidden="true" className="block size-4 shrink-0 rounded-full border-2 border-dashed border-wait" /><span>Waiting for <span className="font-medium text-text-2">Dana R.</span>, engineering manager</span></>}
                    {i === 2 && <><Seal size={18} /><span>Signed by <span className="font-medium text-text-2">Dana R.</span>, engineering manager, Voltline</span></>}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button href="/signup" size="lg" className="h-12 rounded-xl px-5">Create your free account</Button>
          <a href="#app" className="text-[15px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-text">Or try the app first, right here</a>
        </div>
        <p className="mt-4 text-xs text-faint">An example, to show how an entry reads at each step.</p>
      </div>
    </section>
  );
}
