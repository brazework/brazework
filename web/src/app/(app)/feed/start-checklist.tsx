"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/forge";
import type { GuideStep } from "@/lib/guide";
import { DismissButton } from "@/components/app/dismiss";

// The first five minutes on Home, until every step is done. Compact by default: your progress and
// the one next step, with the full list a tap away.
export function StartChecklist({ steps }: { steps: GuideStep[] }) {
  const [all, setAll] = useState(false);
  const done = steps.filter((s) => s.done).length;
  if (!steps.length || done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  const pct = done / steps.length;
  return (
    <section aria-label="Get started" className="glass-card mb-4 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-3.5">
        {/* Progress ring */}
        <div className="relative grid size-11 shrink-0 place-items-center" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={`${done} of ${steps.length} done`}>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 97.4} 97.4`} />
          </svg>
          <span className="text-[11px] font-semibold tabular-nums">{done}/{steps.length}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium tracking-wide text-faint uppercase">Your first five minutes</div>
          <div className="truncate text-sm font-semibold">Next: {next.label}</div>
        </div>
        <Link href={next.href} className="bg-accent-grad hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-on-accent transition hover:opacity-90 sm:inline-flex">
          Start <ArrowRight className="size-4" />
        </Link>
        <DismissButton id="feed-start" label="Hide your first five minutes" className="-mr-1.5 self-start sm:self-center" />
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted">{next.why}</p>
      <div className="mt-3 flex items-center gap-2">
        <Link href={next.href} className="bg-accent-grad inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-on-accent sm:hidden">
          Start <ArrowRight className="size-4" />
        </Link>
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted transition hover:bg-hover hover:text-text">
          All steps <ChevronDown className={cn("size-3.5 transition", all && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {all && (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
              {steps.map((s, i) => (
                <li key={s.id}>
                  <Link href={s.href} aria-current={s.id === next.id ? "step" : undefined} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-hover">
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold", s.done ? "bg-ok text-white" : s.id === next.id ? "bg-text text-bg" : "border border-line text-faint")}>
                      {s.done ? <Check className="size-3" /> : i + 1}
                    </span>
                    <span className={cn(s.done ? "text-muted line-through decoration-faint" : "text-text")}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </div>
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}
