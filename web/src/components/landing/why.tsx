"use client";
import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Kicker } from "@/components/ui";
import { cn } from "@/lib/forge";
import { Reveal } from "./reveal";

const ROWS = [
  ["Your feed", "Viral posts, AI-written thought leadership", "Projects, results and questions from your field"],
  ["Your profile", "Titles and buzzwords", "Build logs and work your club or lab attests"],
  ["Who reaches you", "Any recruiter with a seat license", "Verified people; strangers wait in a request inbox"],
  ["Students", "Judged on internships they don't have yet", "Judged on what they've built"],
  ["Clubs", "Scattered across Discord, Forms and group chats", "Roles, moderation, events and history in one place"],
];

export function Why() {
  const [forge, setForge] = useState(true);
  return (
    <section id="why" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 sm:py-32">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <Reveal className="lg:sticky lg:top-32">
          <Kicker>Why Forge</Kicker>
          <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
            General networks weren&apos;t <span className="font-display font-normal italic text-molten">built for builders.</span>
          </h2>
          <p className="mt-5 text-lg text-muted">
            Hiring is drowning in AI-generated applications and polished profiles. What still cuts through is real work, vouched for by people who saw it happen.
          </p>
          <div role="group" aria-label="Compare" className="glass mt-8 inline-flex rounded-full p-1">
            {[["General networks", false], ["Forge", true]].map(([label, v]) => (
              <button
                key={String(label)}
                onClick={() => setForge(v as boolean)}
                aria-pressed={forge === v}
                className="relative rounded-full px-5 py-2 text-sm text-muted transition aria-pressed:text-text"
              >
                {forge === v && <motion.span layoutId="cmp" className="absolute inset-0 rounded-full bg-raised" />}
                <span className="relative">{label as string}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <div className="divide-y divide-line rounded-3xl border border-line bg-surface/50">
          {ROWS.map(([k, them, us], i) => (
            <Reveal key={k} delay={i * 0.05} className="grid gap-2.5 p-5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-6 sm:p-6">
              <div className="font-mono text-xs tracking-wider text-faint uppercase">{k}</div>
              <motion.div key={String(forge)} initial={{ opacity: 0, x: forge ? 12 : -12 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3">
                <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", forge ? "bg-accent/15 text-accent" : "bg-raised text-faint")}>
                  {forge ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                </span>
                <span className={cn("text-[15px]", forge ? "text-text" : "text-muted line-through decoration-faint/40")}>{forge ? us : them}</span>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
