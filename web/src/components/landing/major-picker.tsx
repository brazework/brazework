"use client";
import { AnimatePresence, motion } from "motion/react";
import { Quote } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { PROFESSIONS } from "./professions";

// Phones: every major at a glance as a grid of tiles; tap one to see a post someone in it would
// make and the clubs they'd join. (Bigger screens get the flip cards in profession-grid.tsx.)
export function MajorPicker() {
  const [i, setI] = useState(0);
  const p = PROFESSIONS[i];
  return (
    <div>
      <div role="tablist" aria-label="Majors" className="grid grid-cols-4 gap-2">
        {PROFESSIONS.map((x, n) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={n === i}
            onClick={() => setI(n)}
            className={cn("flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition active:scale-95", n === i ? "border-line-strong bg-surface shadow-[var(--shadow)]" : "border-transparent")}
          >
            <span className={cn("grid size-9 place-items-center rounded-xl text-white transition", n === i ? "scale-110" : "opacity-85")} style={{ background: x.grad }}><x.icon className="size-[18px]" /></span>
            <span className={cn("w-full truncate text-[11px] leading-tight", n === i ? "font-semibold text-text" : "text-muted")}>{x.short}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={p.id} role="tabpanel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="relative mt-3 overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.grad }} aria-hidden="true" />
          <div className="text-sm font-semibold">{p.title}</div>
          <p className="mt-2 flex gap-1.5 text-sm leading-snug text-text-2"><Quote className="mt-0.5 size-3.5 shrink-0 text-faint" /> {p.post}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{p.clubs.map((c) => <span key={c} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-text-2">{c}</span>)}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
