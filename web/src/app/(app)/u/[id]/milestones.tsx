"use client";
import { proofSource } from "@/lib/proof-source";
import { ProofPicker } from "@/components/projects/proof-picker";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Clock, ExternalLink, Eye, EyeOff, Flag, GitMerge, Loader2, Plus, Scale, Share2, Trash2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { FreshSeal } from "@/components/app/fresh-seal";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { signerNote } from "@/lib/signers";
import { LINKEDIN_PLACEHOLDER, LINKEDIN_PRIVATE, LINKEDIN_WHY } from "@/lib/linkedin";
import { addMilestone, addMilestoneEvidence, disputeMilestone, removeMilestone, setMilestoneVisible, shareMilestone, type EvidenceItem, type MilestoneState } from "@/lib/milestones";
import { approvedLine } from "@/lib/backing";
import { proofPostText, proofUrl, shareLinks } from "@/lib/proof-card";
import { PublicLine } from "./public-line";
import { VerifyLinkButton } from "./verify-link";
import { submitWithoutReset } from "@/lib/submit";
import { RELATIONSHIPS } from "@/lib/vouch-email";

export type Milestone = {
  id: string; project_id: string; community_id: string | null; community_name: string; title: string; detail: string; evidence: string;
  achieved_on: string; status: "draft" | "logged" | "pending" | "verified" | "declined" | "refused" | "revoked" | "disputed"; reviewer_name: string; review_note: string;
  // With supabase/verification.sql:
  private?: boolean; revoked_reason?: string; reviewer_role?: string; reviewed_at?: string | null; escalated?: boolean;
  // With supabase/vouches.sql: "Name, Role · domain" when someone vouched instead of a club.
  vouched_by?: string;
  // With supabase/backed.sql: what GitHub backs (one row, or none).
  milestone_backings?: Backing | Backing[] | null;
  // With supabase/proof-cards.sql: when the member shared it as a public link (/p/<id>), or null.
  shared_at?: string | null;
  // With supabase/redacted-proof.sql: the one line other members see for private signed work (owner only).
  public_line?: string;
  // With supabase/verification.sql: evidence beyond the first link; with milestone-late-evidence.sql, some
  // added later, and marked when that was after it was signed (FIX-238).
  evidence_items?: EvidenceItem[];
};
export type Backing = { kind: "commit" | "pull_request" | "release"; repo_full_name: string; ref: string; url: string; checked_at: string; approvals?: number | null; approvers?: string[] | null };
const backingOf = (m: Milestone): Backing | null => (Array.isArray(m.milestone_backings) ? m.milestone_backings[0] ?? null : m.milestone_backings ?? null);
// "PR #12 in bencho/test-stand": what was checked, in a few words.
const backedWhat = (b: Backing) => `${b.kind === "commit" ? `Commit ${b.ref.slice(0, 7)}` : b.kind === "pull_request" ? `PR #${b.ref}` : `Release ${b.ref}`} in ${b.repo_full_name}`;
// `signers`: the officers who could sign your work there (lib/signers.ts); undefined when not loaded.
export type Club = { id: string; name: string; signers?: string[] };

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// A project's milestones as a small timeline. Others only ever see verified ones and logged ones
// GitHub backs (the database hides the rest); the owner also sees what's waiting and what was declined, with the club's note.
export function MilestoneTimeline({ items, own, projectPrivate = false }: { items: Milestone[]; own: boolean; projectPrivate?: boolean }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [patch, setPatch] = useState<Record<string, Partial<Milestone>>>({});
  const [disputing, setDisputing] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState("");
  const [addPending, startAdd] = useTransition();
  const [, start] = useTransition();
  const shown = items.filter((m) => !gone.has(m.id)).map((m) => ({ ...m, ...patch[m.id] }));
  if (!shown.length) return null;
  // More evidence after logging (FIX-238): at most 8 extra items, not while it's revoked or disputed.
  const canAddEvidence = (m: Milestone) => own && m.evidence_items !== undefined && m.evidence_items.length < 8 && m.status !== "revoked" && m.status !== "disputed";
  const addEvidence = (m: Milestone) => startAdd(async () => {
    const r = await addMilestoneEvidence(m.id, evidenceDraft);
    setMsg(r.message);
    if (r.ok && r.item) { setPatch((p) => ({ ...p, [m.id]: { ...p[m.id], evidence_items: [...(m.evidence_items ?? []), r.item!] } })); setAdding(null); setEvidenceDraft(""); }
  });
  const refused = (s: Milestone["status"]) => s === "declined" || s === "refused";
  return (
    <ol className="relative mt-4 flex flex-col gap-3 border-l-2 border-line pl-4">
      {msg && <li className="text-xs text-muted" role="status">{msg}</li>}
      <AnimatePresence initial={false}>
        {shown.map((m) => (
          <motion.li key={m.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className={cn("relative", m.status === "pending" && "rounded-xl border border-dashed border-line-strong px-2.5 py-2")}>
            <span className={cn("absolute top-0.5 -left-[25px] grid size-[18px] place-items-center rounded-full ring-4 ring-surface", m.status === "verified" ? "bg-ok text-white" : m.status === "logged" ? "bg-info text-white" : m.status === "pending" || m.status === "disputed" || m.status === "draft" ? "bg-raised text-muted" : "bg-danger text-white")}>
              {m.status === "verified" ? <BadgeCheck className="size-3" /> : m.status === "disputed" ? <Scale className="size-3" /> : m.status === "logged" ? <GitMerge className="size-3" /> : m.status === "pending" || m.status === "draft" ? <Clock className="size-3" /> : <X className="size-3" />}
            </span>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.title}</div>
                {m.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted">{m.detail}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-faint">{day(m.achieved_on)}</span>
                  {/* The badge: who verified it, their role, the club and when. */}
                  {m.status === "verified" && m.vouched_by && (
                    <span className="inline-block max-w-full rounded-lg bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 font-medium text-ok">
                      <FreshSeal id={m.id} at={m.reviewed_at}><BadgeCheck className="block size-3" /></FreshSeal>Signed by {m.vouched_by}{m.reviewed_at ? ` · ${new Date(m.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}
                    </span>
                  )}
                  {m.status === "verified" && !m.vouched_by && (
                    // Inline text, not flex: on a phone the sentence wraps as one line of text instead of
                    // splitting into columns (each text piece was its own flex item).
                    <span className="inline-block max-w-full rounded-lg bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 font-medium text-ok">
                      <FreshSeal id={m.id} at={m.reviewed_at}><BadgeCheck className="block size-3" /></FreshSeal>Verified{m.reviewer_name ? ` by ${m.reviewer_name}` : ""}{m.reviewer_role ? ` (${m.reviewer_role})` : ""}{m.community_name && <>, {m.community_id ? <Link href={`/c/${m.community_id}`} className="hover:underline">{m.community_name}</Link> : m.community_name}</>}{m.reviewed_at ? ` · ${new Date(m.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}
                    </span>
                  )}
                  {m.status === "pending" && <span data-waiting className="inline-flex items-center gap-1 rounded-full border border-dashed border-wait/60 bg-[color-mix(in_oklab,var(--wait)_9%,transparent)] px-2 py-0.5 font-medium text-wait"><Clock className="size-3" /> {m.community_id ? `Waiting for ${m.community_name}` : "Waiting for a vouch"}</span>}
                  {m.status === "draft" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted">Draft</span>}
                  {/* Backed by data, never "verified": a different colour, the word "Backed", and what was checked. */}
                  {backingOf(m) && m.status !== "revoked" && (() => { const b = backingOf(m)!; return (
                    <a href={b.url} target="_blank" rel="noopener noreferrer" data-backed title={`Checked with GitHub on ${new Date(b.checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}: made by this member's own GitHub account.${approvedLine(b) ? " A reviewer approved this pull request on GitHub; that isn't a signature given to Brazework." : ""}`}
                      className="inline-block max-w-full rounded-lg bg-[color-mix(in_oklab,var(--info)_13%,transparent)] px-2 py-0.5 font-medium text-info hover:underline">
                      <GitMerge className="mr-1 inline size-3 align-[-2px]" />Backed by GitHub · {backedWhat(b)}{approvedLine(b) && <span data-approved> · {approvedLine(b)}</span>}
                    </a>
                  ); })()}
                  {m.status === "logged" && !backingOf(m) && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted">Logged</span>}
                  {refused(m.status) && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-2 py-0.5 text-danger"><XCircle className="size-3" /> Not verified by {m.community_name}</span>}
                  {m.status === "revoked" && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-2 py-0.5 text-danger"><XCircle className="size-3" /> Revoked by {m.community_name}</span>}
                  {m.status === "disputed" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted"><Scale className="size-3" /> Disputed · {m.escalated ? "with Brazework admins" : "with the club's owner"}</span>}
                  {m.evidence && <a href={m.evidence} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-muted hover:text-text"><ExternalLink className="size-3" /> {proofSource(m.evidence)?.label ?? "Evidence"}</a>}
                  {/* Evidence beyond the first link. Anything added after it was signed says so, with the
                      date, so nobody mistakes it for what the signer saw. */}
                  {(m.evidence_items ?? []).filter((e) => e.url).map((e) => (
                    <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer nofollow" data-late={e.after_signing ? "" : undefined} className="inline-flex items-center gap-1 text-muted hover:text-text">
                      <ExternalLink className="size-3" /> {proofSource(e.url!)?.label ?? "Evidence"}
                      {e.after_signing && <span className="rounded bg-surface-2 px-1 text-faint">added after signing{e.added_at ? ` · ${new Date(e.added_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</span>}
                    </a>
                  ))}
                  {canAddEvidence(m) && adding !== m.id && (
                    <button type="button" onClick={() => { setAdding(m.id); setEvidenceDraft(""); }} className="inline-flex items-center gap-1 font-medium text-text-2 hover:text-text"><Plus className="size-3" /> Add evidence</button>
                  )}
                  {own && (m.status === "verified" || (m.status === "logged" && backingOf(m))) && m.private !== undefined && (
                    <button type="button" onClick={() => start(async () => { const r = await setMilestoneVisible(m.id, !!m.private); setMsg(r.message); if (r.ok) setPatch((p) => ({ ...p, [m.id]: { private: !m.private } })); })} className="inline-flex items-center gap-1 text-muted hover:text-text">
                      {m.private ? <><EyeOff className="size-3" /> Only you · Show on profile</> : <><Eye className="size-3" /> On your profile · Hide</>}
                    </button>
                  )}
                  {/* Proof without revealing (redacted-proof.sql): one public line for private signed work. */}
                  {own && m.status === "verified" && (m.private || projectPrivate) && m.public_line !== undefined && <PublicLine id={m.id} line={m.public_line} />}
                  {/* Résumé verify link (verify-links.sql): a public page and QR code for a signed, public milestone. */}
                  {own && m.status === "verified" && m.private === false && <VerifyLinkButton id={m.id} title={m.title} />}
                  {/* Proof cards (FIX-128): share a signed or backed result as a public link. */}
                  {own && m.shared_at !== undefined && (m.status === "verified" || m.status === "pending" || (m.status === "logged" && backingOf(m))) && (
                    <button type="button" onClick={() => setSharing(m.id)} className="inline-flex items-center gap-1 font-medium text-text-2 hover:text-text">
                      <Share2 className="size-3" /> {m.shared_at ? "Shared · Link" : "Share"}
                    </button>
                  )}
                </div>
                {adding === m.id && (
                  <form className="mt-2 flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); addEvidence(m); }}>
                    <div className="flex gap-2">
                      <label htmlFor={`ev-${m.id}`} className="sr-only">Evidence link for {m.title}</label>
                      <input id={`ev-${m.id}`} autoFocus value={evidenceDraft} onChange={(e) => setEvidenceDraft(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setAdding(null)} maxLength={300} placeholder="github.com/you/repo, the Onshape doc, the write-up…" className={cn(inputCls, "h-9 min-w-0 flex-1 text-xs")} />
                      <Button type="submit" disabled={addPending || !evidenceDraft.trim()}>{addPending && <Loader2 className="size-4 animate-spin" />} Add</Button>
                      <Button type="button" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                    </div>
                    {m.status === "verified" && <p className="text-[11px] text-faint">It&apos;s already signed: the signature stays, and this shows as added after signing.</p>}
                  </form>
                )}
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
      {sharing && (() => { const m = shown.find((x) => x.id === sharing); return m ? <ShareProof m={m} onClose={() => setSharing(null)} onChange={(shared_at, priv) => setPatch((p) => ({ ...p, [m.id]: { shared_at, private: priv } }))} /> : null; })()}
    </ol>
  );
}

// Share one result as a public proof card: what anyone with the link sees, then the link and where to
// post it. Nothing is public until "Create link"; "Stop sharing" takes it down (supabase/proof-cards.sql).
function ShareProof({ m, onClose, onChange }: { m: Milestone; onClose: () => void; onChange: (shared_at: string | null, priv: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const url = typeof window === "undefined" ? `/p/${m.id}` : proofUrl(window.location.origin, m.id);
  const b = backingOf(m);
  const text = proofPostText({ id: m.id, title: m.title, detail: m.detail, achieved_on: m.achieved_on, level: m.status === "verified" ? "signed" : m.status === "pending" ? "waiting" : "backed", project: "",
    member: { id: "", first: "", last: "", headline: "", avatar: "" },
    witness: m.status === "verified" ? { name: m.reviewer_name, role: m.reviewer_role ?? "", club: m.community_name, vouched_by: m.vouched_by ?? "", at: m.reviewed_at ?? null } : null,
    backing: b ? { kind: b.kind, repo: b.repo_full_name, ref: b.ref, url: b.url, approvals: b.approvals ?? 0, approvers: b.approvers ?? [] } : null, image: null, shared_at: "" });
  const links = shareLinks(url, text);
  const set = (on: boolean) => start(async () => { const r = await shareMilestone(m.id, on); setMsg(r.message); if (r.ok) onChange(on ? new Date().toISOString() : null, on ? false : !!m.private); });
  const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:border-line-strong hover:bg-hover";
  return (
    <dialog ref={ref} aria-label="Share this result" onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto w-[min(480px,calc(100vw-24px))] rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/60">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Share this result</h2>
            <p className="mt-1 text-sm text-muted">{m.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        {!m.shared_at ? (
          <>
            <p className="text-sm leading-relaxed text-text-2">Anyone with the link sees this result, your name and headline, and {m.status === "verified" ? "who signed it" : m.status === "pending" ? "that it's waiting for a signature (once it's signed, the same link shows who signed it)" : "what GitHub checked"}. It also shows on your profile. You can stop sharing at any time.</p>
            <button type="button" disabled={pending} onClick={() => set(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90 disabled:opacity-60">{pending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Create link</button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="Link to this result" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm" />
              <button type="button" onClick={() => { navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => {}); }} className={btn}>{copied ? "Copied" : "Copy link"}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className={btn}>Post to LinkedIn</a>
              <a href={links.x} target="_blank" rel="noopener noreferrer" className={btn}>Post to X</a>
              <a href={`/p/${encodeURIComponent(m.id)}/opengraph-image`} download={`brazework-proof-${m.id}.png`} className={btn}>Download image</a>
              <a href={`/p/${encodeURIComponent(m.id)}`} target="_blank" rel="noopener noreferrer" className={btn}>Open the page</a>
            </div>
            <button type="button" disabled={pending} onClick={() => set(false)} className="self-start text-sm font-medium text-muted underline underline-offset-4 hover:text-text">Stop sharing</button>
          </>
        )}
        {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      </div>
    </dialog>
  );
}

const initial: MilestoneState = { ok: false, message: "" };

// "Add milestone": what happened, when, a link to the evidence, and the club that saw it.
// `vouches`: whether the database has vouches (supabase/vouches.sql); until then it's clubs only.
// `backing`: whether "No one yet: back it with GitHub" is on (supabase/backed.sql run, GitHub App set up).
export function AddMilestone({ projectId, projectTitle, clubs, vouches = false, backing = false, field }: { projectId: string; projectTitle: string; clubs: Club[]; vouches?: boolean; backing?: boolean; field?: string | null }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 text-xs font-medium text-text-2 transition hover:border-solid hover:bg-hover active:scale-95">
        {sent && <Celebrate pieces={16} />}
        <Flag className="size-3.5" /> Add milestone
      </button>
      {open && <MilestoneDialog projectId={projectId} projectTitle={projectTitle} clubs={clubs} vouches={vouches} backing={backing} field={field} onClose={() => setOpen(false)} onSent={() => setSent(true)} />}
    </>
  );
}

function MilestoneDialog({ projectId, projectTitle, clubs, vouches, backing, field, onClose, onSent }: { projectId: string; projectTitle: string; clubs: Club[]; vouches: boolean; backing: boolean; field?: string | null; onClose: () => void; onSent: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(addMilestone, initial);
  const [by, setBy] = useState<"club" | "vouch" | "data">(clubs.length || !vouches ? "club" : "vouch");
  // Who can sign in the chosen club, said before you ask (not as an error after).
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const club = clubs.find((c) => c.id === clubId);
  const note = club?.signers ? signerNote(club.name, club.signers) : null;
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (state.ok) { onSent(); onClose(); } }, [state.ok, onSent, onClose]);
  // A working account adds its LinkedIn link before asking a person to sign (Linear FIX-214): when
  // the server says it's missing or wrong, the field shows. Once saved, it isn't asked again.
  const askLinkedin = Boolean(state.linkedin);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto max-h-[92dvh] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Add a milestone</h2>
            <p className="mt-1 text-sm text-muted">On <span className="font-medium text-text-2">{projectTitle}</span>. {by === "data" ? "We check it with GitHub, and if it's your own work it shows as backed on your profile." : "Someone who saw it confirms it happened, and it shows as verified on your profile."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <input type="hidden" name="projectId" value={projectId} />
        <Field label="What happened?"><input name="title" maxLength={120} required placeholder="e.g. Passed load test at 3.2 g" className={inputCls} /></Field>
        <Field label="Details" hint="Numbers, conditions, who was there."><textarea name="detail" maxLength={600} rows={3} className={cn(inputCls, "h-auto resize-none py-3")} /></Field>
        <div className="sm:w-1/2 sm:pr-2"><Field label="When"><input name="achievedOn" type="date" max={today} defaultValue={today} required className={inputCls} /></Field></div>
        <ProofPicker field={field} label="Evidence" required />
        {!vouches && !clubs.length && <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Milestones are verified by a club you belong to. <Link href="/communities?tab=discover" className="font-medium text-text underline underline-offset-4">Join your club</Link> first.</p>}
        {vouches && <fieldset>
          <legend className="text-sm font-medium">Who confirms it?</legend>
          <input type="hidden" name="verifyBy" value={by} />
          <div role="radiogroup" className={cn("mt-2 grid grid-cols-1 gap-2", backing ? "sm:grid-cols-3" : "grid-cols-2")}>
            {([["club", "Your club", clubs.length ? "Its officers verify it" : "You're not in one yet"], ["vouch", "Someone who saw it", "A professor, TA, PI, coworker or mentor"], ...(backing ? [["data", "No one yet", "Back it with GitHub: your own commit, merged pull request or release"]] : [])] as [("club" | "vouch" | "data"), string, string][]).map(([id, label, hint]) => (
              <button key={id} type="button" role="radio" aria-checked={by === id} disabled={id === "club" && !clubs.length} onClick={() => setBy(id)}
                className={cn("rounded-xl border p-3 text-left transition disabled:opacity-50", by === id ? "border-text bg-surface-2" : "border-line hover:border-line-strong")}>
                <span className="block text-sm font-medium">{label}</span>
                <span className="mt-0.5 block text-xs text-muted">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>}
        {by === "club" ? (clubs.length > 0 && (
          <Field label="Which club saw it happen?">
            <select name="communityId" required value={clubId} onChange={(e) => setClubId(e.target.value)} className={inputCls}>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {note && (
              <p role="status" className={cn("mt-2 rounded-xl px-3 py-2 text-xs leading-relaxed", note.ok ? "bg-surface-2 text-text-2" : "border border-[color-mix(in_oklab,var(--pro)_40%,transparent)] bg-[color-mix(in_oklab,var(--pro)_10%,transparent)] text-text")}>
                {note.text}
                {!note.ok && vouches && <> <button type="button" onClick={() => setBy("vouch")} className="font-medium underline underline-offset-2">Ask someone who saw it</button></>}
              </p>
            )}
          </Field>
        )) : by === "vouch" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Their email" hint="A university or work address carries the most weight; a personal one (like Gmail) works too. We email them a link; they don't need an account. The signature says which kind of address it came from.">
              <input name="vouchEmail" type="email" required maxLength={254} autoComplete="off" placeholder="name@company.com" className={inputCls} />
            </Field>
            <Field label="They're">
              <select name="vouchRelationship" required defaultValue="professor" className={inputCls}>
                {Object.entries(RELATIONSHIPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {askLinkedin && (
              <div className="sm:col-span-2">
                <Field label="Your LinkedIn profile" hint={`${LINKEDIN_WHY} ${LINKEDIN_PRIVATE}`}>
                  <input name="linkedin" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder={LINKEDIN_PLACEHOLDER} className={inputCls} />
                </Field>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-text-2">
            Paste a link to your own commit on the main branch, a merged pull request or a published release, in a repo linked to this project. We check it with GitHub; if it&apos;s yours, it shows as <span className="font-medium text-text">Backed by GitHub</span>. That isn&apos;t the same as signed: anyone reading your profile sees the difference.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-text-2">
          <input type="checkbox" name="showOnProfile" defaultChecked className="size-4 accent-[var(--accent)]" />
          Show it on my profile once it&apos;s {by === "data" ? "backed" : "verified"}
        </label>
        {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending || (by === "club" && !clubs.length)}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {by === "club" ? "Ask for verification" : by === "vouch" ? "Ask them to vouch" : "Back it with GitHub"}</Button>
        </div>
      </form>
    </dialog>
  );
}
