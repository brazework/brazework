"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, ChevronDown, Clock, Megaphone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn, timeAgo } from "@/lib/forge";
import { QuickUpdate } from "./quick-update";
import type { BenchProject } from "./workbench";

// One project on your workbench. Click it to open its update log: every update you've posted,
// newest first, as a timeline under the card. The arrow opens the full project page.
export function BenchCard({ p }: { p: BenchProject }) {
  const [open, setOpen] = useState(false);
  const logId = `log-${p.id}`;
  return (
    <li className="glass-card flex flex-col rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={logId} className="group min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold group-hover:underline">{p.title}</span>
            <ChevronDown className={cn("size-4 shrink-0 text-faint transition", open && "rotate-180")} />
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{p.summary}</span>
        </button>
        {p.private && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">Private</span>}
        <Link href={`/projects/${p.id}`} aria-label={`Open ${p.title}`} title="Open the project page" className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text">
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      {/* Where it stands on the way to proof. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={p.verified ? "inline-flex items-center gap-1 font-medium text-ok" : "inline-flex items-center gap-1 text-faint"}><BadgeCheck className="size-3.5" /> {p.verified} verified</span>
        <span className={p.waiting ? "inline-flex items-center gap-1 text-text-2" : "inline-flex items-center gap-1 text-faint"}><Clock className="size-3.5" /> {p.waiting} waiting</span>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={logId} className="inline-flex items-center gap-1 text-faint transition hover:text-text">
          <Megaphone className="size-3.5" /> {p.updates} update{p.updates === 1 ? "" : "s"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={logId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <section aria-label={`Updates on ${p.title}`} className="mt-4 border-t border-line pt-4">
              {p.log.length === 0 ? (
                <p className="text-xs text-muted">No updates yet. Post the first one below: what you built, tested or learned.</p>
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

      <div className="mt-4 flex flex-wrap gap-2">
        <QuickUpdate projectId={p.id} title={p.title} />
        <Link href={`/projects/${p.id}#milestones`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-xs font-medium transition hover:bg-hover"><ShieldCheck className="size-3.5" /> {p.verified || p.waiting ? "Milestones" : "Ask to verify"}</Link>
      </div>
    </li>
  );
}
