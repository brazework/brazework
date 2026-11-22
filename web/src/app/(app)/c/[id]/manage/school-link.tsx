"use client";
import { BadgeCheck, Clock, GraduationCap, Loader2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, inputCls } from "@/components/ui";
import { cn, timeAgo } from "@/lib/forge";
import { removeSchoolLink, requestSchoolLink, type SchoolLink } from "@/lib/school-links";
import { emailAtDomain, schoolDomain } from "@/lib/school-domain";

// Manage → School: ask to be verified as a club of your school, and see where it stands. The school
// (once Brazework has set up its official account) or the Brazework team reviews it. Since FIX-237 the
// ask goes from an officer's confirmed email at the school (`needsSchoolEmail`), so the school knows
// they're its students; `email` is yours, to say which address it goes from before you send it.
export function SchoolLinkPanel({ cid, link, canEdit, email = "", needsSchoolEmail = false, notice = "" }: { cid: string; link: SchoolLink | null; canEdit: boolean; email?: string; needsSchoolEmail?: boolean; notice?: string }) {
  const [editing, setEditing] = useState(!link);
  const [school, setSchool] = useState(link?.school_name ?? "");
  const [website, setWebsite] = useState(link ? `https://${link.school_domain}` : "");
  const [evidence, setEvidence] = useState(link?.evidence_url ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(notice ? { ok: false, text: notice } : null);
  const domain = schoolDomain(website);
  const wrongEmail = needsSchoolEmail && !!domain && !emailAtDomain(email, domain);
  const [pending, start] = useTransition();
  const send = () => start(async () => { const r = await requestSchoolLink(cid, school, website, evidence); setMsg({ ok: r.ok, text: r.message }); if (r.ok) setEditing(false); });
  const remove = () => { if (confirm(link?.status === "verified" ? "Stop being listed as a club of this school? The badge goes too." : "Take back this request?")) start(async () => { const r = await removeSchoolLink(cid); setMsg({ ok: r.ok, text: r.message }); if (r.ok) setEditing(true); }); };

  return (
    <section aria-labelledby="school-title">
      <h2 id="school-title" className="inline-flex items-center gap-2 text-base font-semibold"><GraduationCap className="size-5 text-muted" /> School</h2>
      <p className="mt-1 text-sm text-muted">If your club operates under a university, get it verified: it shows a &ldquo;Verified club of&rdquo; badge and is listed among the school&apos;s clubs.</p>

      {link && !editing && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {link.status === "verified" && <span className="inline-flex items-center gap-1.5 font-medium text-ok"><BadgeCheck className="size-4" /> Verified club of {link.school_name}</span>}
            {link.status === "pending" && <span className="inline-flex items-center gap-1.5 font-medium"><Clock className="size-4 text-muted" /> Waiting for review: {link.school_name}</span>}
            {link.status === "declined" && <span className="inline-flex items-center gap-1.5 font-medium text-danger"><XCircle className="size-4" /> Not verified: {link.school_name}</span>}
            <span suppressHydrationWarning className="text-xs text-faint">{link.school_domain} · asked {timeAgo(link.requested_at)}</span>
          </div>
          {link.status === "declined" && link.decision_note && <p className="mt-2 text-sm text-text-2">&ldquo;{link.decision_note}&rdquo;</p>}
          {link.status === "pending" && <p className="mt-2 text-xs text-muted">The school reviews this once Brazework has set up its official account; until then the Brazework team does.</p>}
          {canEdit && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:bg-hover">{link.status === "declined" ? "Ask again" : "Change school"}</button>
              <button type="button" disabled={pending} onClick={remove} className="h-9 rounded-lg px-3.5 text-sm text-muted transition hover:bg-hover hover:text-danger">{link.status === "pending" ? "Take back the request" : "Remove"}</button>
            </div>
          )}
        </div>
      )}

      {editing && canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">School<input value={school} onChange={(e) => setSchool(e.target.value)} maxLength={120} placeholder="University of Hartford" className={inputCls} required /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">School website<input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://hartford.edu" className={inputCls} required /></label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">
            Proof the club is part of the school
            <input value={evidence} onChange={(e) => setEvidence(e.target.value)} type="url" placeholder="https://… the club's page in the school's student-organization directory" className={inputCls} required />
            <span className="text-xs font-normal text-faint">A page on the school&apos;s site that lists your club works best.</span>
          </label>
          {needsSchoolEmail && (
            wrongEmail
              ? <p role="note" className="rounded-xl border border-line bg-surface-2/70 px-3.5 py-2.5 text-sm text-text-2">The school needs to know the people asking are its students, so this goes from an @{domain} email. You&apos;re signed in as {email || "an address that isn't confirmed"}. <a href="/settings#account" className="font-medium underline-offset-4 hover:underline">Change your email in Settings</a>, or ask another officer with an @{domain} address.</p>
              : <p className="text-xs text-faint">{domain ? <>Sent from your confirmed address, {email}, so the school knows you study there.</> : <>It goes from your confirmed school email, so the school knows you study there.</>}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || wrongEmail || !school.trim() || !website.trim() || !evidence.trim()}>{pending && <Loader2 className="size-4 animate-spin" />} Ask to be verified</Button>
            {link && <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-lg px-3.5 text-sm text-muted hover:bg-hover hover:text-text">Cancel</button>}
          </div>
        </form>
      )}
      {!canEdit && !link && <p className="mt-3 text-sm text-faint">The club&apos;s officers can ask to verify it with its school.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("mt-3 text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
    </section>
  );
}
