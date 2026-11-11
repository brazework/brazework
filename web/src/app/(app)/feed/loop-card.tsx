"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, Check, Eye, Flame, Hammer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/forge";
import type { LoopStep } from "@/lib/week";

// The build loop at the top of Home (Linear FIX-67): Brazework's path as three connected steps
// (build, get verified, get found), each done, now or next from your real data. Tap a step to see
// the one thing to do for it. Your build streak sits on top, with the last eight weeks underneath.
const ICON = { build: Hammer, verify: BadgeCheck, found: Eye } as const;

export function LoopCard({ steps, streak, recent, verifyQueue }: {
  steps: LoopStep[];
  streak: { weeks: number; thisWeek: boolean };
  recent: boolean[];
  verifyQueue: { href: string; n: number } | null;
}) {
  const start = Math.max(0, steps.findIndex((s) => s.state === "now"));
  const [open, setOpen] = useState(start);
  const step = steps[open];
  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <section aria-label="Your build loop" className="glass-card relative mb-4 overflow-hidden rounded-[26px] p-4 sm:p-5">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]" />

      {/* Officers: what's waiting on them first. */}
      {verifyQueue && (
        <Link href={verifyQueue.href} className="relative mb-3.5 flex items-center gap-2.5 rounded-2xl bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] px-3.5 py-2.5 text-sm transition hover:bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]">
          <BadgeCheck className="size-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate"><strong className="font-semibold">{verifyQueue.n}</strong> {verifyQueue.n === 1 ? "milestone is" : "milestones are"} waiting for you to verify</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">Review <ArrowRight className="size-3.5" /></span>
        </Link>
      )}

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Your build loop</h2>
          <p className="text-xs text-muted">{doneCount === 3 ? "Every step done this week. Keep building." : `${doneCount} of 3 this week`}</p>
        </div>
        {/* The streak: weeks in a row with work shown. */}
        <div className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5", streak.weeks ? "border-orange-500/25 bg-[linear-gradient(135deg,color-mix(in_oklab,#f97316_14%,transparent),color-mix(in_oklab,#f59e0b_8%,transparent))]" : "border-line bg-surface-2/60")}>
          <motion.span animate={streak.weeks && streak.thisWeek ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }} className="grid place-items-center">
            <Flame className={cn("size-4", streak.weeks ? "fill-orange-500/25 text-orange-500" : "text-faint")} />
          </motion.span>
          <span className="text-sm font-semibold tabular-nums">{streak.weeks ? `${streak.weeks}-week streak` : "No streak yet"}</span>
        </div>
      </div>

      {/* The three steps, connected. */}
      <ol className="relative mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Build, verify, get found">
        <span aria-hidden className="absolute top-[22px] right-[16.6%] left-[16.6%] h-px bg-line" />
        <motion.span aria-hidden className="bg-accent-grad absolute top-[22px] left-[16.6%] h-px origin-left" initial={false} animate={{ width: `${(Math.max(0, steps.filter((s) => s.state === "done").length - 1) / 2) * 66.8}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
        {steps.map((s, i) => {
          const Icon = ICON[s.id];
          const on = i === open;
          return (
            <li key={s.id} className="relative flex justify-center">
              <button type="button" role="tab" aria-selected={on} aria-controls="loop-step" onClick={() => setOpen(i)}
                className={cn("group flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 pt-0.5 pb-2 transition", on ? "bg-surface-2/70" : "hover:bg-hover/60")}>
                <span className={cn("relative grid size-11 place-items-center rounded-full transition duration-300",
                  s.state === "done" ? "bg-ok text-white shadow-[0_6px_18px_-8px_var(--ok)]"
                    : s.state === "now" ? "bg-accent-grad text-on-accent shadow-[0_8px_22px_-10px_var(--accent)]"
                      : "border border-line bg-surface text-faint group-hover:text-text-2")}>
                  {s.state === "done" ? <Check className="size-5" /> : <Icon className="size-[18px]" />}
                  {s.state === "now" && <span aria-hidden className="absolute -inset-1 animate-pulse rounded-full ring-2 ring-[color-mix(in_oklab,var(--accent)_28%,transparent)] [animation-duration:2.4s]" />}
                </span>
                <span className={cn("text-xs font-medium", on ? "text-text" : "text-muted")}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* What to do for the open step. */}
      <div id="loop-step" role="tabpanel" className="relative mt-2 min-h-[3.25rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface/70 px-3.5 py-3">
            <p className="min-w-0 flex-1 basis-48 text-sm">
              <span className={cn("mr-1.5 text-[11px] font-semibold tracking-wide uppercase", step.state === "done" ? "text-ok" : step.state === "now" ? "text-accent" : "text-faint")}>{step.state === "done" ? "Done" : step.state === "now" ? "Next up" : "Then"}</span>
              {step.line}
            </p>
            {step.cta && (
              <Link href={step.cta.href} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95", step.state === "now" ? "bg-accent-grad text-on-accent hover:opacity-90" : "border border-line hover:bg-hover")}>
                {step.cta.label} <ArrowRight className="size-4" />
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* The last eight weeks. */}
      <div className="relative mt-3.5 flex items-center gap-3" aria-label={`Work shown in ${recent.filter(Boolean).length} of the last 8 weeks`}>
        <span className="shrink-0 text-[11px] text-faint">8 weeks</span>
        <div className="flex flex-1 items-center gap-1" aria-hidden="true">
          {recent.map((on, i) => {
            const now = i === recent.length - 1;
            return <span key={i} className={cn("h-2 flex-1 rounded-full transition", on ? "bg-[linear-gradient(90deg,#f97316,#f59e0b)]" : now ? "border border-dashed border-line-strong" : "bg-surface-2")} />;
          })}
        </div>
        <span className="shrink-0 text-[11px] text-faint">{streak.thisWeek ? "This week ✓" : "This week"}</span>
      </div>
    </section>
  );
}
