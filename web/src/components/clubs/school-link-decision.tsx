"use client";
import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { decideSchoolLink } from "@/lib/school-links";

// Approve or decline a club's request to be verified as one of a school's clubs (Brazework admins on
// /admin, or the school's official admins on /org). Declining can carry a short note for the club.
export function SchoolLinkDecision({ cid }: { cid: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const decide = (approve: boolean) => start(async () => { setError(""); const r = await decideSchoolLink(cid, approve, approve ? "" : note); if (r.ok) setDone(r.message); else setError(r.message); });
  if (done) return <span role="status" className="text-sm text-muted">{done}</span>;
  return (
    <div className="flex flex-col items-end gap-2">
      {declining ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="sr-only" htmlFor={`sln-${cid}`}>Note for the club</label>
          <input id={`sln-${cid}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Why (optional, the club sees this)" className="h-9 w-64 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-text" />
          <button type="button" disabled={pending} onClick={() => decide(false)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-danger transition hover:bg-hover">{pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Decline</button>
          <button type="button" onClick={() => setDeclining(false)} className="h-9 rounded-lg px-2 text-sm text-muted hover:text-text">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => decide(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text px-3 text-sm font-medium text-surface transition hover:opacity-90">{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Verify</button>
          <button type="button" onClick={() => setDeclining(true)} className="h-9 rounded-lg border border-line px-3 text-sm font-medium transition hover:bg-hover">Decline…</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
