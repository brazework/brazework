"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Kicker } from "@/components/ui";
import { ALL_TOPICS, TOPICS } from "@/lib/forge";
import { Reveal } from "./reveal";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Marquee() {
  const row = ALL_TOPICS.slice(0, 24);
  return (
    <div className="relative overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="rounded-full border border-line bg-surface/60 px-4 py-2 font-mono text-xs whitespace-nowrap text-muted">
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Disciplines() {
  const [active, setActive] = useState<string>(TOPICS[0].name);
  const group = TOPICS.find((t) => t.name === active) ?? TOPICS[0];

  // Arrow keys move between tabs, as the ARIA tabs pattern expects.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = TOPICS.findIndex((t) => t.name === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TOPICS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = TOPICS.at((next + TOPICS.length) % TOPICS.length)!;
    setActive(t.name);
    document.getElementById(`tab-${slug(t.name)}`)?.focus();
  };

  return (
    <section id="disciplines" className="relative scroll-mt-24 border-y border-line bg-surface/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-3xl">
          <Kicker>Communities</Kicker>
          <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
            Find your people. <span className="text-shine">Every discipline.</span>
          </h2>
          <p className="mt-5 text-lg text-muted">Feeds and project galleries that stay on topic. Pick a field to look inside.</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div
            role="tablist"
            aria-label="Fields"
            onKeyDown={onKey}
            className="no-scrollbar -mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            {TOPICS.map((t) => (
              <button
                key={t.name}
                id={`tab-${slug(t.name)}`}
                role="tab"
                aria-selected={t.name === active}
                aria-controls="field-panel"
                tabIndex={t.name === active ? 0 : -1}
                onClick={() => setActive(t.name)}
                className="relative shrink-0 snap-start rounded-full px-4 py-2 text-sm whitespace-nowrap text-muted transition hover:text-text aria-selected:text-on-accent"
              >
                {t.name === active && (
                  <motion.span layoutId="field-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                <span className="relative">{t.name}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <div id="field-panel" role="tabpanel" aria-labelledby={`tab-${slug(group.name)}`} className="relative mt-8 min-h-[220px] overflow-hidden rounded-3xl border border-line bg-bg/60 p-6 sm:p-8">
          <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60" />
          <AnimatePresence mode="wait">
            <motion.div
              key={group.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="relative"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">{group.name}</h3>
                <Link href="/signup" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Join {group.name} on Forge <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {group.topics.map((t, i) => (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.04 * i }}
                    className="rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-text-2 transition hover:-translate-y-0.5 hover:border-accent/50"
                  >
                    {t}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-12 sm:mt-16"><Marquee /></div>
    </section>
  );
}
