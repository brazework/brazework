"use client";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Clock, ExternalLink, Flag, Loader2, Plus, Trash2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { addMilestone, removeMilestone, type MilestoneState } from "@/lib/milestones";
import { submitWithoutReset } from "@/lib/submit";

export type Milestone = {
  id: string; project_id: string; community_id: string; community_name: string; title: string; detail: string; evidence: string;
  achieved_on: string; status: "pending" | "verified" | "declined"; reviewer_name: string; review_note: string;
};
export type Club = { id: string; name: string };

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// A project's milestones as a small timeline. Others only ever see verified ones (the database
// hides the rest); the owner also sees what's waiting and what was declined, with the club's note.
export function MilestoneTimeline({ items, own }: { items: Milestone[]; own: boolean }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const shown = items.filter((m) => !gone.has(m.id));
  if (!shown.length) return null;
  return (
    <ol className="relative mt-4 flex flex-col gap-3 border-l-2 border-line pl-4">
      <AnimatePresence initial={false}>
        {shown.map((m) => (
          <motion.li key={m.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="relative">
            <span className={cn("absolute top-0.5 -left-[25px] grid size-[18px] place-items-center rounded-full ring-4 ring-surface", m.status === "verified" ? "bg-ok text-white" : m.status === "pending" ? "bg-raised text-muted" : "bg-danger text-white")}>
              {m.status === "verified" ? <BadgeCheck className="size-3" /> : m.status === "pending" ? <Clock className="size-3" /> : <X className="size-3" />}
            </span>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.title}</div>
                {m.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted">{m.detail}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-faint">{day(m.achieved_on)}</span>
                  {m.status === "verified" && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 font-medium text-ok"><BadgeCheck className="size-3" /> Verified by <Link href={`/c/${m.community_id}`} className="underline-offset-2 hover:underline">{m.community_name}</Link>{m.reviewer_name && <> · {m.reviewer_name}</>}</span>}
                  {m.status === "pending" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted"><Clock className="size-3" /> Waiting for {m.community_name}</span>}
                  {m.status === "declined" && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-2 py-0.5 text-danger"><XCircle className="size-3" /> Not verified by {m.community_name}</span>}
                  {m.evidence && <a href={m.evidence} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-muted hover:text-text"><ExternalLink className="size-3" /> Evidence</a>}
                </div>
                {m.status === "declined" && m.review_note && <p className="mt-1 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-text-2">&ldquo;{m.review_note}&rdquo;</p>}
              </div>
              {own && (
                <button type="button" aria-label={`Remove milestone ${m.title}`} onClick={() => confirm("Remove this milestone?") && start(async () => { const r = await removeMilestone(m.id); if (r.ok) setGone((g) => new Set(g).add(m.id)); })} className="grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

const initial: MilestoneState = { ok: false, message: "" };

// "Add milestone": what happened, when, a link to the evidence, and the club that saw it.
export function AddMilestone({ projectId, projectTitle, clubs }: { projectId: string; projectTitle: string; clubs: Club[] }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-xs font-medium text-text-2 transition hover:border-solid hover:bg-hover active:scale-95">
        {sent && <Celebrate pieces={16} />}
        <Flag className="size-3.5" /> Add milestone
      </button>
      {open && <MilestoneDialog projectId={projectId} projectTitle={projectTitle} clubs={clubs} onClose={() => setOpen(false)} onSent={() => setSent(true)} />}
    </>
  );
}

function MilestoneDialog({ projectId, projectTitle, clubs, onClose, onSent }: { projectId: string; projectTitle: string; clubs: Club[]; onClose: () => void; onSent: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(addMilestone, initial);
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (state.ok) { onSent(); onClose(); } }, [state.ok, onSent, onClose]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto max-h-[92dvh] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Add a milestone</h2>
            <p className="mt-1 text-sm text-muted">On <span className="font-medium text-text-2">{projectTitle}</span>. Your club confirms it happened, and it shows as verified on your profile.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <input type="hidden" name="projectId" value={projectId} />
        <Field label="What happened?"><input name="title" maxLength={120} required placeholder="e.g. Passed load test at 3.2 g" className={inputCls} /></Field>
        <Field label="Details" hint="Numbers, conditions, who was there."><textarea name="detail" maxLength={600} rows={3} className={cn(inputCls, "h-auto resize-none py-3")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When"><input name="achievedOn" type="date" max={today} defaultValue={today} required className={inputCls} /></Field>
          <Field label="Evidence link (optional)"><input name="evidence" type="url" maxLength={300} placeholder="https://…" className={inputCls} /></Field>
        </div>
        {clubs.length ? (
          <Field label="Which club saw it happen?">
            <select name="communityId" required defaultValue={clubs[0].id} className={inputCls}>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Milestones are verified by a club you belong to. <Link href="/communities?tab=discover" className="font-medium text-text underline underline-offset-4">Join your club</Link> first.</p>
        )}
        {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending || !clubs.length}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ask for verification</Button>
        </div>
      </form>
    </dialog>
  );
}
