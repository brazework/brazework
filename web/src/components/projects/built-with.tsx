"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Boxes } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { STACK_CATEGORIES, groupStack } from "@/lib/stack";
import { cn } from "@/lib/forge";

// A project's "Built with" stack, grouped by kind of tool. Tap a tool for what it's for and how many
// other projects on Brazework use it, and jump to them: the tools are what connect builders across majors.
export function BuiltWith({ tools, uses }: { tools: string[]; uses: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = groupStack(tools);
  const label = (c: string) => STACK_CATEGORIES.find((x) => x.id === c)?.label ?? "Other";
  const Icon = (c: string) => STACK_CATEGORIES.find((x) => x.id === c)?.icon ?? Boxes;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {groups.map((g) => {
        const I = Icon(g.cat);
        return (
          <div key={g.cat} className="rounded-2xl border border-line p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted"><span className="nav-tile grid size-7 place-items-center rounded-lg text-text-2"><I className="size-3.5" /></span>{label(g.cat)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.tools.map((t) => (
                <button key={t.name} type="button" aria-expanded={open === t.name} onClick={() => setOpen(open === t.name ? null : t.name)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition", open === t.name ? "border-transparent bg-text text-bg" : "border-line bg-surface/70 text-text-2 hover:border-line-strong hover:text-text")}>
                  {t.name}
                </button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {g.tools.some((t) => t.name === open) && (() => {
                const t = g.tools.find((x) => x.name === open)!;
                const others = Math.max(0, (uses[t.name] ?? 1) - 1);
                return (
                  <motion.div key={t.name} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-2 rounded-xl bg-surface-2/70 p-3 text-xs">
                      <p className="text-text-2">{t.what || `${t.name}, used in this project.`}</p>
                      <Link href={`/projects?tool=${encodeURIComponent(t.name)}`} className="mt-2 inline-flex items-center gap-1 font-medium text-text hover:underline">
                        {others ? `${others} other project${others === 1 ? "" : "s"} on Brazework use${others === 1 ? "s" : ""} it` : "See projects built with it"} <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
