"use client";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Clock, Eye, EyeOff, ExternalLink, Flag, Loader2, Plus, Scale, Trash2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { addMilestone, disputeMilestone, removeMilestone, setMilestoneVisible, type MilestoneState } from "@/lib/milestones";
import { submitWithoutReset } from "@/lib/submit";

export type Milestone = {
  id: string; project_id: string; community_id: string; community_name: string; title: string; detail: string; evidence: string;
  achieved_on: string; status: "draft" | "pending" | "verified" | "declined" | "refused" | "revoked" | "disputed"; reviewer_name: string; review_note: string;
  // With supabase/verification.sql:
  private?: boolean; revoked_reason?: string; reviewer_role?: string; reviewed_at?: string | null; escalated?: boolean;
};
export type Club = { id: string; name: string };

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// A project's milestones as a small timeline. Others only ever see verified ones (the database
// hides the rest); the owner also sees what's waiting and what was declined, with the club's note.
export function MilestoneTimeline({ items, own }: { items: Milestone[]; own: boolean }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [patch, setPatch] = useState<Record<string, Partial<Milestone>>>({});
  const [disputing, setDisputing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const shown = items.filter((m) => !gone.has(m.id)).map((m) => ({ ...m, ...patch[m.id] }));
  if (!shown.length) return null;
  const refused = (s: Milestone["status"]) => s === "declined" || s === "refused";
  return (
    <ol className="relative mt-4 flex flex-col gap-3 border-l-2 border-line pl-4">
      {msg && <li className="text-xs text-muted" role="status">{msg}</li>}
      <AnimatePresence initial={false}>
        {shown.map((m) => (
          <motion.li key={m.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="relative">
            <span className={cn("absolute top-0.5 -left-[25px] grid size-[18px] place-items-center rounded-full ring-4 ring-surface", m.status === "verified" ? "bg-ok text-white" : m.status === "pending" || m.status === "disputed" || m.status === "draft" ? "bg-raised text-muted" : "bg-danger text-white")}>
              {m.status === "verified" ? <BadgeCheck className="size-3" /> : m.status === "disputed" ? <Scale className="size-3" /> : m.status === "pending" || m.status === "draft" ? <Clock className="size-3" /> : <X className="size-3" />}
            </span>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.title}</div>
                {m.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted">{m.detail}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-faint">{day(m.achieved_on)}</span>
                  {/* The badge: who verified it, their role, the club and when. */}
                  {m.status === "verified" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 font-medium text-ok">
                      <BadgeCheck className="size-3" /> Verified{m.reviewer_name ? ` by ${m.reviewer_name}` : ""}{m.reviewer_role ? ` (${m.reviewer_role})` : ""}, <Link href={`/c/${m.community_id}`} className="hover:underline">{m.community_name}</Link>{m.reviewed_at ? ` · ${new Date(m.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                    </span>
                  )}
                  {m.status === "pending" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted"><Clock className="size-3" /> Waiting for {m.community_name}</span>}
                  {m.status === "draft" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted">Draft</span>}
                  {refused(m.status) && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-2 py-0.5 text-danger"><XCircle className="size-3" /> Not verified by {m.community_name}</span>}
                  {m.status === "revoked" && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-2 py-0.5 text-danger"><XCircle className="size-3" /> Revoked by {m.community_name}</span>}
                  {m.status === "disputed" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted"><Scale className="size-3" /> Disputed · {m.escalated ? "with Brazework admins" : "with the club's owner"}</span>}
                  {m.evidence && <a href={m.evidence} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-muted hover:text-text"><ExternalLink className="size-3" /> Evidence</a>}
                  {own && m.status === "verified" && m.private !== undefined && (
                    <button type="button" onClick={() => start(async () => { const r = await setMilestoneVisible(m.id, !!m.private); setMsg(r.message); if (r.ok) setPatch((p) => ({ ...p, [m.id]: { private: !m.private } })); })} className="inline-flex items-center gap-1 text-muted hover:text-text">
                      {m.private ? <><EyeOff className="size-3" /> Only you · Show on profile</> : <><Eye className="size-3" /> On your profile · Hide</>}
                    </button>
                  )}
                </div>
                {refused(m.status) && m.review_note && <p className="mt-1 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-text-2">&ldquo;{m.review_note}&rdquo;</p>}
                {m.status === "revoked" && m.revoked_reason && <p className="mt-1 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-text-2">&ldquo;{m.revoked_reason}&rdquo;</p>}
                {own && (refused(m.status) || m.status === "revoked") && (disputing === m.id ? (
                  <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await disputeMilestone(m.id, note); setMsg(r.message); if (r.ok) { setPatch((p) => ({ ...p, [m.id]: { status: "disputed", escalated: false } })); setDisputing(null); setNote(""); } }); }}>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} required placeholder="What happened? The club's owner decides first; if they disagree, Brazework admins look at it." className={cn(inputCls, "h-auto resize-none py-2 text-xs")} />
                    <div className="flex gap-2"><Button type="submit">Send dispute</Button><Button type="button" variant="ghost" onClick={() => setDisputing(null)}>Cancel</Button></div>
                  </form>
                ) : (
                  <button type="button" onClick={() => { setDisputing(m.id); setNote(""); }} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-text-2 hover:text-text"><Scale className="size-3" /> Dispute this</button>
                ))}
              </div>
              {own && !["verified", "revoked", "disputed"].includes(m.status) && (
                <button type="button" aria-label={`Remove milestone ${m.title}`} onClick={() => confirm("Remove this milestone?") && start(async () => { const r = await removeMilestone(m.id); if (r.ok) setGone((g) => new Set(g).add(m.id)); })} className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-danger">
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
      <button type="button" onClick={() => setOpen(true)} className="relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 text-xs font-medium text-text-2 transition hover:border-solid hover:bg-hover active:scale-95">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="When"><input name="achievedOn" type="date" max={today} defaultValue={today} required className={inputCls} /></Field>
          <Field label="Evidence" hint="A photo, video, file, commit or the event page."><input name="evidence" type="url" required maxLength={300} placeholder="https://…" className={inputCls} /></Field>
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
        <label className="flex items-center gap-2 text-sm text-text-2">
          <input type="checkbox" name="showOnProfile" defaultChecked className="size-4 accent-[var(--accent)]" />
          Show it on my profile once it&apos;s verified
        </label>
        {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending || !clubs.length}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ask for verification</Button>
        </div>
      </form>
    </dialog>
  );
}
