"use client";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { BadgeCheck, Building2, Mail, Search, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// The two angles that close the loop on the landing page (Linear FIX-92, FIX-94), as live mocks that
// play while on screen (still for reduced motion). Example data.

/** Steps through `n` beats every `ms` while the element is on screen; all at once for reduced motion. */
function useBeats(n: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(() => setBeat((b) => (b + 1) % n), beat === n - 1 ? ms * 1.6 : ms);
    return () => clearTimeout(t);
  }, [beat, inView, reduce, n, ms]);
  return { ref, beat: reduce ? n - 1 : beat, reduce };
}

const card = "rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]";
const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } as const;

// No club: the ask lands in a professor's inbox, they say what they saw, and it's on the record.
export function VouchMock() {
  const { ref, beat } = useBeats(3, 2600);
  return (
    <div ref={ref} className="relative flex min-h-[360px] flex-col justify-center gap-3" aria-hidden="true">
      <motion.div layout className={card}>
        <p className="flex items-center gap-2 text-xs text-muted"><Mail className="size-3.5" /> To: prof.lee@utexas.edu</p>
        <p className="mt-2 text-sm font-semibold">Ben Cho asked you to vouch for their work</p>
        <p className="mt-1 rounded-lg border-l-2 border-text bg-surface-2/70 px-3 py-2 text-sm">Thrust stand reads within 2% · Liquid engine test stand</p>
        <span className="mt-3 inline-flex rounded-md bg-text px-3 py-1.5 text-xs font-medium text-bg">Vouch or decline</span>
      </motion.div>
      <AnimatePresence>
        {beat >= 1 && (
          <motion.div {...rise} layout className={card}>
            <p className="text-xs font-medium text-faint">What did you see them do?</p>
            <p className="mt-1 text-sm text-text-2">I watched the calibration run in my lab; the readings matched the reference weights.</p>
            <p className="mt-2 text-xs text-faint">Dr. Priya Lee · Assistant Professor · his research advisor</p>
          </motion.div>
        )}
        {beat >= 2 && (
          <motion.div {...rise} layout className={cn(card, "flex items-center gap-2.5")}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-ok"><BadgeCheck className="size-4" /></span>
            <span className="min-w-0 text-sm"><b className="font-semibold">On Ben&apos;s record</b><span className="block truncate text-xs text-ok">Vouched for by Dr. Priya Lee, Assistant Professor · utexas.edu</span></span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The other side: a lab searches verified work, sees who signed it, and asks to talk.
const RESULTS = [
  { name: "Aisha Bello", what: "Battery management board · 0.4% ripple", proof: "Verified by IEEE Student Branch", weeks: "active 9 of 12 weeks" },
  { name: "Ben Cho", what: "Thrust stand within 2%", proof: "Vouched for by Dr. Priya Lee · utexas.edu", weeks: "active 7 of 12 weeks" },
  { name: "Dev Shah", what: "Shuttle tracker · 41 merged PRs", proof: "Verified by ACM Chapter", weeks: "active 11 of 12 weeks" },
];
const QUERY = "PCB bring-up, verified";

export function SearchMock() {
  const { ref, beat, reduce } = useBeats(4, 1900);
  const [typed, setTyped] = useState(reduce ? QUERY.length : 0);
  useEffect(() => {
    if (beat !== 0) return;
    let i = 0;
    const t = setInterval(() => { i += 1; setTyped(i); if (i >= QUERY.length) clearInterval(t); }, 45);
    return () => clearInterval(t);
  }, [beat]);
  const q = beat === 0 && !reduce ? QUERY.slice(0, typed) : QUERY;
  return (
    <div ref={ref} className="relative flex min-h-[380px] flex-col gap-3" aria-hidden="true">
      <div className={cn(card, "flex items-center gap-2.5 py-3")}>
        <Search className="size-4 text-muted" />
        <span className="flex-1 text-sm">{q}<span className="ml-px inline-block h-4 w-px translate-y-[3px] animate-pulse bg-current" /></span>
        <span className="hidden gap-1 sm:flex">{["Electrical", "Signed", "Active"].map((f) => <span key={f} className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">{f}</span>)}</span>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence>
          {beat >= 1 && RESULTS.map((r, i) => (
            <motion.li key={r.name} {...rise} transition={{ ...rise.transition, delay: i * 0.12 }} className={cn(card, "flex items-center gap-3 py-3", beat >= 2 && i === 0 && "border-line-strong")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{r.name.split(" ").map((w) => w[0]).join("")}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.name} <span className="font-normal text-muted">· {r.what}</span></span>
                <span className="block truncate text-xs text-ok">{r.proof} <span className="text-faint">· {r.weeks}</span></span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <AnimatePresence>
        {beat >= 3 && (
          <motion.div {...rise} className={cn(card, "flex items-start gap-3")}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-text text-bg"><Building2 className="size-4" /></span>
            <span className="min-w-0 text-sm">
              <b className="font-semibold">Volt Systems</b> <span className="text-muted">→ Aisha · in her Requests</span>
              <span className="mt-1 block text-text-2">&ldquo;Your scope captures are exactly what our power team does. Free to talk this week?&rdquo;</span>
            </span>
            <Send className="ml-auto size-4 shrink-0 text-muted" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
