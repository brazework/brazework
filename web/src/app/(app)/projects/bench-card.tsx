"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, Check, ChevronDown, Clock, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Model3D } from "@/components/landing/model-3d";
import { MODELS } from "@/components/landing/models";
import { Schematic } from "@/components/landing/schematics";
import { buildStage, nextBuildStep } from "@/lib/build-step";
import { cn, timeAgo } from "@/lib/forge";
import { QuickUpdate } from "./quick-update";
import type { BenchProject } from "./workbench";

// One of your builds on the Build page. Top to bottom: the build itself as a model you can turn (it
// spins while you point at it; drag to look around), what it is and how fresh, where it stands on the
// way from built to signed, and the one thing worth doing next (lib/build-step.ts). The update log
// opens under the card; the arrow opens the full project page.
export function BenchCard({ p, attach = false }: { p: BenchProject; attach?: boolean }) {
  const [open, setOpen] = useState(false);
  const logId = `log-${p.id}`;
  const step = nextBuildStep(p), stage = buildStage(p);
  const STAGES = [
    { label: "Built", note: `${p.updates} update${p.updates === 1 ? "" : "s"}`, done: stage >= 1 },
    { label: "Signed", note: p.waiting ? `${p.verified} signed · ${p.waiting} waiting` : `${p.verified} signed`, done: stage >= 2 },
  ];
  return (
    <li className="glass-card group/card flex flex-col overflow-hidden rounded-2xl transition hover:border-line-strong">
      {/* The stage: the build, not a description of it. */}
      <div className="cover-empty relative aspect-[16/7] overflow-hidden text-text">
        {MODELS[p.field]
          ? <Model3D id={p.field} spin="hover" className="absolute inset-0 size-full" />
          : <Schematic id={p.field} className="absolute top-1/2 left-1/2 w-[42%] -translate-x-1/2 -translate-y-1/2 text-text/40" />}
        <span className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-surface/90 px-2 py-0.5 text-[11px] text-text ring-1 ring-line">
          <span className={cn("size-1.5 rounded-full", p.status === "completed" ? "bg-ok" : "bg-orange-500")} aria-hidden="true" />{p.status === "completed" ? "Completed" : "In progress"}
        </span>
        {p.private && <span className="pointer-events-none absolute top-3 left-[7.5rem] inline-flex items-center gap-1 rounded-md bg-surface/90 px-2 py-0.5 text-[11px] text-text ring-1 ring-line"><Lock className="size-3" /> Private</span>}
        <Link href={`/projects/${p.id}`} aria-label={`Open ${p.title}`} title="Open the project page" className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg bg-surface/90 text-text-2 ring-1 ring-line transition hover:text-text">
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link href={`/projects/${p.id}`} className="line-clamp-1 text-[17px] font-semibold tracking-tight hover:underline">{p.title}</Link>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{p.summary || "No summary yet."}</p>

        {/* Where it stands: built, then signed. */}
        <ol className="mt-4 grid grid-cols-2 gap-2" aria-label="Where this build stands">
          {STAGES.map((s) => (
            <li key={s.label} className={cn("rounded-xl border px-3 py-2", s.done ? "border-transparent bg-[color-mix(in_oklab,var(--ok)_10%,transparent)]" : "border-line")}>
              <span className={cn("flex items-center gap-1.5 text-xs font-medium", s.done ? "text-ok" : "text-muted")}>
                {s.done ? <Check className="size-3.5" /> : <span className="size-3.5 rounded-full border border-line-strong" aria-hidden="true" />} {s.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-faint tabular-nums">{s.note}</span>
            </li>
          ))}
        </ol>

        {/* The one next step, and why. */}
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          {step.kind === "waiting" ? <Clock className="mt-px size-3.5 shrink-0" /> : step.kind === "verify" ? <ShieldCheck className="mt-px size-3.5 shrink-0" /> : <BadgeCheck className="mt-px size-3.5 shrink-0" />}
          <span><span className="font-medium text-text-2">Next: {step.label}.</span> {step.hint}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {step.kind === "verify"
            ? <Link href={`/projects/${p.id}#milestones`} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-on-accent"><ShieldCheck className="size-3.5" /> Get it verified</Link>
            : null}
          <QuickUpdate projectId={p.id} title={p.title} attach={attach} quiet={step.kind === "verify"} />
          {step.kind !== "verify" && <Link href={`/projects/${p.id}#milestones`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-xs font-medium transition hover:bg-hover"><ShieldCheck className="size-3.5" /> {p.verified || p.waiting ? "Milestones" : "Ask to verify"}</Link>}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={logId} className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted transition hover:bg-hover hover:text-text">
            Log <span className="tabular-nums">({p.updates})</span> <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div id={logId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
              <section aria-label={`Updates on ${p.title}`} className="mt-4 border-t border-line pt-4">
                {p.log.length === 0 ? (
                  <p className="text-xs text-muted">No updates yet. Post the first one: what you built, tested or learned.</p>
                ) : (
                  <ol className="relative ml-1.5 border-l border-line">
                    {p.log.map((u) => (
                      <li key={u.id} className="relative pb-4 pl-4 last:pb-0">
                        <span aria-hidden="true" className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-surface bg-accent-grad" />
                        <div className="flex items-center gap-2 text-[11px] text-faint">
                          <time dateTime={u.created_at}>{timeAgo(u.created_at)}</time>
                          {u.status !== "visible" && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-muted">Held for review</span>}
                        </div>
                        <Link href={`/post/${u.id}`} className="mt-0.5 line-clamp-3 block text-sm whitespace-pre-line text-text-2 hover:text-text">{u.body}</Link>
                      </li>
                    ))}
                  </ol>
                )}
                {p.updates > p.log.length && (
                  <Link href={`/projects/${p.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-text">See all {p.updates} updates <ArrowUpRight className="size-3.5" /></Link>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-3 text-[11px] text-faint">Updated {timeAgo(p.updated_at)}</p>
      </div>
    </li>
  );
}
