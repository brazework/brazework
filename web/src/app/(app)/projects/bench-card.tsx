"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, Box, Check, ChevronDown, Clock, Lock, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ModelViewer } from "@/components/projects/model-viewer";
import { activeWeeks, buildPath, nextBuildStep } from "@/lib/build-step";
import { cn, timeAgo } from "@/lib/forge";
import { PostUpdate } from "./[id]/post-update";
import type { BenchProject } from "./workbench";

// One of your builds on the Build page. Everything on the card is yours and true: what it is, how
// steadily you've worked on it (twelve weeks of updates), where it stands on the way from logged to
// signed, and a box to log today's progress without leaving the page. There is no stock picture: a
// build with a photo shows it, and one with an uploaded 3D model opens it right here.
export function BenchCard({ p, attach = false }: { p: BenchProject; attach?: boolean }) {
  const [open, setOpen] = useState(false);
  const [in3d, setIn3d] = useState(false);
  // Just logged from this card: the next thing is to ask someone to sign it.
  const [logged, setLogged] = useState(false);
  const logId = `log-${p.id}`;
  const step = nextBuildStep(p), path = buildPath(p), active = activeWeeks(p.weeks), peak = Math.max(1, ...p.weeks);
  return (
    <li className="glass-card flex flex-col rounded-2xl p-4 sm:p-5">
      {/* What it is. */}
      <div className="flex items-start gap-3">
        {p.cover && (
          <Link href={`/projects/${p.id}`} aria-hidden="true" tabIndex={-1} className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2">
            <Image src={p.cover.src} alt="" fill sizes="56px" className="object-cover" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/projects/${p.id}`} className="block truncate text-[17px] font-semibold tracking-tight hover:underline">{p.title}</Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", p.status === "completed" ? "bg-ok" : "bg-orange-500")} aria-hidden="true" />{p.status === "completed" ? "Completed" : "In progress"}</span>
            {p.private && <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Private</span>}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.summary || "No summary yet."}</p>
        </div>
        <Link href={`/projects/${p.id}`} aria-label={`Open ${p.title}`} title="Open the project page" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-hover hover:text-text"><ArrowUpRight className="size-4" /></Link>
      </div>

      {/* How steadily: one bar a week for twelve weeks, the newest on the right. */}
      <div className="mt-4 flex items-end gap-3">
        <div role="img" aria-label={active ? `Updates in ${active} of the last 12 weeks` : "No updates in the last 12 weeks"} className="flex h-7 shrink-0 items-end gap-[3px]">
          {p.weeks.map((n, i) => <span key={i} className={cn("w-2 rounded-[2px]", n ? "bg-text" : "bg-line-strong")} style={{ height: n ? `${Math.max(30, (n / peak) * 100)}%` : "3px" }} />)}
        </div>
        <p className="text-xs leading-tight text-muted">{active ? `Active ${active} of 12 weeks` : "Nothing logged in 12 weeks"}<span className="block text-faint">Updated {timeAgo(p.updated_at)}</span></p>
      </div>

      {/* Where it stands: logged, asked, signed. */}
      <ol aria-label="Where this build stands" className="mt-4 grid grid-cols-3 gap-2">
        {path.map((s) => (
          <li key={s.id} className={cn("rounded-lg border px-2.5 py-2", s.done ? "border-transparent bg-[color-mix(in_oklab,var(--ok)_9%,var(--surface))]" : "border-line")}>
            <span className={cn("flex items-center gap-1.5 text-xs font-medium", s.done ? "text-ok" : "text-muted")}>
              {s.done ? <Check className="size-3.5" /> : <span className="size-3.5 rounded-full border border-line-strong" aria-hidden="true" />} {s.label}
            </span>
            <span className="mt-0.5 block text-[11px] text-faint tabular-nums">{s.note}</span>
          </li>
        ))}
      </ol>

      {/* Log today's progress, right here. */}
      <PostUpdate compact projectId={p.id} title={p.title} attach={attach} onPosted={() => setLogged(true)} className="mt-4" />

      {/* The one next step, and why. Right after logging, it's asking for a signature. */}
      {logged ? (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-2">
          <Check className="size-3.5 shrink-0 text-ok" /> Logged.
          <Link href={`/projects/${p.id}#milestones`} className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">Ask someone who saw it to sign it</Link>
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          {step.kind === "waiting" ? <Clock className="mt-px size-3.5 shrink-0" /> : step.kind === "verify" ? <ShieldCheck className="mt-px size-3.5 shrink-0" /> : <BadgeCheck className="mt-px size-3.5 shrink-0" />}
          <span><span className="font-medium text-text-2">Next: {step.label}.</span> {step.hint}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/projects/${p.id}#milestones`} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition", step.kind === "verify" ? "bg-accent-grad text-on-accent" : "border border-line hover:bg-hover")}>
          <ShieldCheck className="size-3.5" /> {step.kind === "verify" ? "Get it signed" : p.verified ? "Milestones" : "Add a milestone"}
        </Link>
        {p.verified > 0 && <Link href="/profile" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-xs font-medium transition hover:bg-hover"><BadgeCheck className="size-3.5" /> On your Proof</Link>}
        {p.model && (
          <button type="button" onClick={() => setIn3d(!in3d)} aria-expanded={in3d} title={p.model.name} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-xs font-medium transition hover:bg-hover">
            {in3d ? <X className="size-3.5" /> : <Box className="size-3.5" />} {in3d ? "Close 3D" : "View in 3D"}
          </button>
        )}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={logId} className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted transition hover:bg-hover hover:text-text">
          Log <span className="tabular-nums">({p.updates})</span> <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
        </button>
      </div>

      {/* Your own uploaded model, opened on the card when you ask (the file downloads only then). */}
      {in3d && p.model && <ModelViewer url={p.model.src} name={p.model.name} className="mt-3 aspect-[4/3] rounded-xl border border-line" />}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={logId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <section aria-label={`Updates on ${p.title}`} className="mt-4 border-t border-line pt-4">
              {p.log.length === 0 ? (
                <p className="text-xs text-muted">No updates yet. Log the first one above: what you built, tested or learned.</p>
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
    </li>
  );
}
