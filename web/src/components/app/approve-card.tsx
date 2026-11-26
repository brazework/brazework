"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ExternalLink, Loader2, PencilLine, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";

// Something Torch or a member's tool drafted, waiting for their OK, right in the page
// (docs/design/app.md). Short until Edit: a title, a line or two, an evidence link. The confirm button
// says what happens ("Log and send to club"); then Edit and Not now. Presentational: the caller runs
// the action and passes `state`. Show "done" at once when they press it (optimistic) and set it back
// to "open" with `error` if the server says no. Nothing here saves anything by itself.

export type ApproveState = "open" | "done" | "dismissed";

export function ApproveCard({
  icon, title, source, summary, confirmLabel, onConfirm, onEdit, editing = false, onDismiss, dismissLabel = "Not now",
  state, pending = false, doneText, doneHref, doneLabel, error, children,
}: {
  icon?: React.ReactNode; title: string; source: string;
  summary?: { title: React.ReactNode; lines?: React.ReactNode[]; link?: string } | null;
  confirmLabel: string; onConfirm: () => void; onEdit?: () => void; editing?: boolean; onDismiss: () => void; dismissLabel?: string;
  state: ApproveState; pending?: boolean; doneText?: string; doneHref?: string; doneLabel?: string; error?: string;
  // The fields, shown when there's no summary or while editing.
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (state === "dismissed") return <p role="status" className="mt-2 text-xs text-faint">Not now. Nothing was saved.</p>;
  const done = state === "done";
  return (
    <motion.div layout={!reduce} role="group" aria-label={`${title}, drafted by ${source}`}
      className={cn("mt-3 rounded-xl border bg-surface p-4 text-sm transition-colors", done ? "border-ok/40" : "border-line-strong")}>
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-4", done ? "bg-ok text-white" : "bg-surface-2 text-text-2")} aria-hidden="true">{done ? <Check /> : icon}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-text">{done ? doneText ?? "Done" : title}</span>
        {!done && <span className="shrink-0 text-xs text-faint">From {source} · not saved yet</span>}
      </div>
      {done ? (
        doneHref && <Link href={doneHref} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-text underline-offset-4 hover:underline">{doneLabel ?? "Open"} <ArrowRight className="size-4" /></Link>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {summary && !editing ? (
            <div>
              <p className="font-medium text-text">{summary.title}</p>
              {summary.lines?.map((l, i) => <p key={i} className="mt-0.5 text-xs text-muted">{l}</p>)}
              {summary.link && <a href={summary.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-text underline underline-offset-4"><ExternalLink className="size-3 shrink-0" /> {summary.link.replace(/^https?:\/\//, "")}</a>}
            </div>
          ) : children}
          <AnimatePresence>{error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="text-xs text-danger">{error}</motion.p>}</AnimatePresence>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onConfirm} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text px-4 text-sm font-semibold text-surface transition hover:opacity-90 active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {confirmLabel}
            </button>
            {onEdit && summary && !editing && <button type="button" onClick={onEdit} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-text-2 transition hover:bg-hover hover:text-text"><PencilLine className="size-4" /> Edit</button>}
            <button type="button" onClick={onDismiss} disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-muted transition hover:text-text"><X className="size-4" /> {dismissLabel}</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
