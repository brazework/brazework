"use client";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Compass, Mic, PenLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Eyebrow, H2 } from "./marketing";

const ASK = "Notes: load test today, carbon upright held 3.2 g, 31% lighter than steel. Next: fatigue test. Make it a post.";
const ANSWER = "Our carbon-fiber upright passed load testing at 3.2 g, at 31% less weight than the steel part it replaces.\n\nNext up: fatigue testing, to make sure it survives a full season. [Add the cycle count you're targeting.]";

const CAPS = [
  { icon: PenLine, title: "Write it up", body: "Rough notes in, a clear post or project write-up out." },
  { icon: Compass, title: "Find your people", body: "Clubs and events on Forge that fit your field and projects." },
  { icon: Mic, title: "Prep for the room", body: "A 30-second pitch of your work before a fair or interview." },
];

// Forge Copilot on the landing page: an example exchange that types itself out once in view.
export function CopilotSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setN((v) => (v >= ANSWER.length ? v : v + 3)), 24);
    return () => clearInterval(id);
  }, [inView, reduce]);
  const shown = reduce ? ANSWER : ANSWER.slice(0, n);

  return (
    <section id="copilot" className="relative isolate scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div className="bg-accent-grad pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <div>
          <Eyebrow>Forge Copilot</Eyebrow>
          <h2 className={`mt-5 ${H2}`}>An AI teammate that <span className="text-grad">never makes things up.</span></h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">Copilot turns your rough notes into posts and write-ups, points you to the clubs and events that fit, and preps you for the room. It only uses what you give it, and anything missing becomes a [placeholder] for you to fill.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {CAPS.map((c) => (
              <li key={c.title} className="spotlight rounded-2xl border border-line bg-surface p-4">
                <span className="bg-accent-grad grid size-9 place-items-center rounded-xl text-on-accent"><c.icon className="size-4" /></span>
                <div className="mt-3 text-sm font-semibold">{c.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div ref={ref} className="rounded-[2rem] border border-line bg-surface-2/60 p-4 shadow-[var(--shadow)] sm:p-6" aria-label="Example Copilot conversation">
          <div className="mb-4 flex items-center gap-2 text-xs text-faint"><Sparkles className="size-3.5" /> Example conversation</div>
          <div className="flex justify-end">
            <p className="bg-accent-grad max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-sm text-on-accent">{ASK}</p>
          </div>
          <div className="mt-4 flex gap-3">
            <span className="bg-accent-grad mt-1 grid size-8 shrink-0 place-items-center rounded-xl text-on-accent"><Sparkles className="size-4" /></span>
            <div className="min-h-[150px] flex-1 rounded-3xl rounded-tl-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-text-2">
              <span className="sr-only">{ANSWER}</span>
              <span aria-hidden="true">{shown}{shown.length < ANSWER.length && <motion.span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-accent" animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
