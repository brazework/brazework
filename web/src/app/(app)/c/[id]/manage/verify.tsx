"use client";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, ExternalLink, Loader2, Scale, Undo2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { resolveDispute, reviewMilestone, revokeMilestone } from "@/lib/milestones";

export type QueueItem = {
  id: string; owner_id: string; title: string; detail: string; evidence: string; achieved_on: string; created_at: string;
  status: "pending" | "verified" | "declined" | "refused" | "revoked" | "disputed" | "draft"; reviewer_name: string; review_note: string;
  dispute_note?: string; escalated?: boolean; revoked_reason?: string;
  // More evidence (verification.sql), and the AI tool that logged it (mcp-milestones.sql), if any.
  evidence_items?: { type: string; url?: string; path?: string; event_id?: string }[]; via?: string | null;
  project: { title: string; summary: string } | null;
  owner: { first_name: string; last_name: string; headline: string } | null;
};

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// The club's verification queue: did this happen? Verify it, or decline with a reason.
export function VerifyQueue({ items }: { items: QueueItem[] }) {
  const [done, setDone] = useState<Record<string, "verified" | "declined">>({});
  const left = items.filter((m) => !done[m.id]).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{left ? `${left} waiting. Verify only what the club saw happen: a test, a build night, a competition result.` : "All caught up."}</p>
      <AnimatePresence initial={false}>
        {items.map((m) => <QueueCard key={m.id} m={m} result={done[m.id]} onDone={(r) => setDone((d) => ({ ...d, [m.id]: r }))} />)}
      </AnimatePresence>
    </div>
  );
}

function QueueCard({ m, result, onDone }: { m: QueueItem; result?: "verified" | "declined"; onDone: (r: "verified" | "declined") => void }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const review = (verify: boolean) => start(async () => {
    const r = await reviewMilestone(m.id, verify, note);
    if (r.ok) onDone(verify ? "verified" : "declined");
    else setMsg(r.message);
  });
  const name = m.owner ? `${m.owner.first_name} ${m.owner.last_name}` : "A member";
  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("grad-edge relative rounded-3xl border p-5 shadow-[var(--shadow)]", result && "opacity-80")}>
      {result === "verified" && <Celebrate />}
      <div className="flex items-start gap-3">
        <Avatar first={m.owner?.first_name ?? "?"} last={m.owner?.last_name ?? ""} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-sm"><Link href={`/u/${m.owner_id}`} className="font-medium hover:underline">{name}</Link> <span className="text-muted">asks the club to verify</span></div>
          <div className="text-xs text-faint">{m.owner?.headline}{m.via && <span title={`${m.owner?.first_name ?? "They"} logged this from ${m.via}, connected in Settings → Your tools`}> · via {m.via}</span>}</div>
        </div>
        <span className="shrink-0 text-xs text-faint">{day(m.achieved_on)}</span>
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-4">
        <div className="text-[11px] font-medium tracking-wide text-faint uppercase">{m.project?.title ?? "Project"}</div>
        <div className="mt-1 font-semibold">{m.title}</div>
        {m.detail && <p className="mt-1 text-sm leading-relaxed text-text-2">{m.detail}</p>}
        {/* Every link: the main one, then the rest (commits, pull requests, videos, docs). */}
        {(() => {
          const links = [...new Set([m.evidence, ...(m.evidence_items ?? []).map((e) => e.url ?? "")].filter((u) => /^https?:\/\//.test(u)))];
          return links.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {links.map((u, i) => (
                <li key={u}><a href={u} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-medium text-text underline underline-offset-4"><ExternalLink className="size-3.5" /> {links.length === 1 ? "Open the evidence" : evidenceLabel(u, i)}</a></li>
              ))}
            </ul>
          );
        })()}
      </div>
      {result ? (
        <p className={cn("mt-4 inline-flex items-center gap-1.5 text-sm font-medium", result === "verified" ? "text-ok" : "text-muted")}>
          {result === "verified" ? <><BadgeCheck className="size-4" /> Verified. {m.owner?.first_name} has been notified.</> : <><XCircle className="size-4" /> Declined.</>}
        </p>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {declining && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <label htmlFor={`note-${m.id}`} className="mt-4 block text-xs font-medium text-muted">Why? {m.owner?.first_name} will see this.</label>
                <input id={`note-${m.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. We didn't see this run. Bring the data to the next build night." className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-line-strong" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {declining ? (
              <>
                <button type="button" disabled={pending} onClick={() => review(false)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger px-4 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50">{pending && <Loader2 className="size-4 animate-spin" />} Decline</button>
                <button type="button" onClick={() => setDeclining(false)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-muted hover:text-text"><X className="size-4" /> Cancel</button>
              </>
            ) : (
              <>
                <button type="button" disabled={pending} onClick={() => review(true)} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:-translate-y-px active:scale-95 disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} Verify</button>
                <button type="button" onClick={() => setDeclining(true)} className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm text-muted transition hover:text-text">Decline</button>
              </>
            )}
            {msg && <span role="alert" className="text-xs text-danger">{msg}</span>}
          </div>
        </>
      )}
    </motion.article>
  );
}

// What the club verified or declined lately, so officers can see each other's calls.
// Recently reviewed, plus what officers can still do: revoke a verification (with a reason), and,
// for the club's owner, decide disputes (uphold → verified; reject → Brazework admins decide).
export function RecentReviews({ items, isOwner = false }: { items: QueueItem[]; isOwner?: boolean }) {
  const [state, setState] = useState<Record<string, QueueItem["status"] | "escalated">>({});
  const [revoking, setRevoking] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!items.length) return null;
  const disputes = items.filter((m) => m.status === "disputed" && !m.escalated && !state[m.id]);
  return (
    <>
      {isOwner && disputes.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Scale className="size-4" /> Disputes for you to decide</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {disputes.map((m) => (
              <li key={m.id} className="rounded-3xl border border-line bg-surface p-4 text-sm">
                <div><span className="font-medium">{m.title}</span> <span className="text-muted">· {m.owner?.first_name} {m.owner?.last_name}</span></div>
                {m.dispute_note && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-text-2">&ldquo;{m.dispute_note}&rdquo;</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={pending} onClick={() => start(async () => { const r = await resolveDispute(m.id, true); setMsg(r.message); if (r.ok) setState((s) => ({ ...s, [m.id]: "verified" })); })} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-grad px-4 text-sm font-medium text-on-accent disabled:opacity-60"><BadgeCheck className="size-4" /> Uphold: verify it</button>
                  <button type="button" disabled={pending} onClick={() => start(async () => { const r = await resolveDispute(m.id, false); setMsg(r.message); if (r.ok) setState((s) => ({ ...s, [m.id]: "escalated" })); })} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-sm disabled:opacity-60">Disagree: send to Brazework admins</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">Recently reviewed</h2>
        {msg && <p role="status" className="mt-2 text-xs text-muted">{msg}</p>}
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-3xl border border-line bg-surface">
          {items.map((m) => {
            const status = state[m.id] ?? m.status;
            return (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  {status === "verified" ? <BadgeCheck className="size-4 shrink-0 text-ok" /> : status === "disputed" || status === "escalated" ? <Scale className="size-4 shrink-0 text-faint" /> : <XCircle className="size-4 shrink-0 text-faint" />}
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium">{m.title}</span> <span className="text-muted">· {m.owner?.first_name} {m.owner?.last_name}</span></span>
                  <span className="shrink-0 text-xs text-faint">{status === "revoked" ? "Revoked" : status === "disputed" ? (m.escalated ? "With Brazework admins" : "Disputed") : status === "escalated" ? "With Brazework admins" : m.reviewer_name}</span>
                  {status === "verified" && revoking !== m.id && (
                    <button type="button" onClick={() => { setRevoking(m.id); setWhy(""); }} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted hover:text-danger"><Undo2 className="size-3.5" /> Revoke</button>
                  )}
                </div>
                {revoking === m.id && (
                  <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await revokeMilestone(m.id, why); setMsg(r.message); if (r.ok) { setState((s) => ({ ...s, [m.id]: "revoked" })); setRevoking(null); } }); }}>
                    <input value={why} onChange={(e) => setWhy(e.target.value)} required minLength={5} maxLength={300} placeholder="Why it's being revoked (they'll see this)" className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3 text-sm" />
                    <button type="submit" disabled={pending} className="h-9 rounded-full bg-danger px-4 text-sm font-medium text-white disabled:opacity-60">Revoke</button>
                    <button type="button" onClick={() => setRevoking(null)} className="h-9 rounded-full px-3 text-sm text-muted">Cancel</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

// A short name for an evidence link: "Commit abc1234", "Pull request #7", or the site.
function evidenceLabel(u: string, i: number): string {
  const c = /\/commits?\/([0-9a-f]{7})/i.exec(u);
  if (c) return `Commit ${c[1]}`;
  const pr = /\/(pull|merge_requests)\/(\d+)/.exec(u);
  if (pr) return `Pull request #${pr[2]}`;
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return `Evidence ${i + 1}`; }
}
