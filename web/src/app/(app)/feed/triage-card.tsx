"use client";
import { BadgeCheck, Check, FileText, GitMerge, Link2, Loader2, PenLine, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, inputCls, selectPillCls } from "@/components/ui";
import { defaultClub, triageActions, triageDone, type TriageAction, type TriageClub } from "@/lib/draft-triage";
import { cn, timeAgo } from "@/lib/forge";
import { askToSignDraft, dismissDraft, triageDraft, type ToolDraft } from "@/lib/tool-drafts";
import { RELATIONSHIPS } from "@/lib/vouch-email";

// One draft on Today, decided in a tap (supabase/daily-triage.sql): Keep, Send to club, Ask to sign or
// Dismiss for a milestone; Post, Post to club or Dismiss for a post. Big targets, no page change; a
// tap that needs one more answer (which club, whose email) opens it in place. Editing lives on /drafts.
export function TriageCard({ draft, project, clubs }: { draft: ToolDraft; project: string | null; clubs: TriageClub[] }) {
  const p = draft.payload;
  const isPost = draft.kind === "post";
  const [open, setOpen] = useState<"club" | "sign" | null>(null);
  const [club, setClub] = useState(defaultClub(p.club_id, clubs) ?? "");
  const [email, setEmail] = useState("");
  const [rel, setRel] = useState("professor");
  const [done, setDone] = useState<{ message: string; url?: string; dismissed?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const title = isPost ? (p.body ?? "") : (p.title ?? "");
  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name;

  const run = (action: TriageAction) => {
    setError("");
    if (action === "sign") { setOpen(open === "sign" ? null : "sign"); return; }
    // Send to club asks which club only when there's a real choice.
    if (action === "club" && clubs.length > 1 && open !== "club") { setOpen("club"); return; }
    start(async () => {
      if (action === "dismiss") {
        const r = await dismissDraft(draft.id);
        if (r.ok) setDone({ message: triageDone("dismiss", draft.kind), dismissed: true }); else setError(r.message);
        return;
      }
      const target = action === "club" ? club || defaultClub(p.club_id, clubs) : null;
      const r = await triageDraft(draft.id, action, target);
      if (r.ok) setDone({ message: triageDone(action, draft.kind, target ? clubName(target) : undefined), url: r.url }); else setError(r.message);
    });
  };
  const sendAsk = () => start(async () => {
    setError("");
    const r = await askToSignDraft(draft.id, email, rel);
    if (r.ok) setDone({ message: r.message, url: r.url }); else setError(r.message);
  });

  if (done) {
    return (
      <article aria-label={`Draft: ${title.slice(0, 40)}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", done.dismissed ? "bg-surface-2 text-muted" : "bg-ok text-white")}>{done.dismissed ? <X className="size-3.5" /> : <Check className="size-3.5" />}</span>
        <span role="status" className="min-w-0 flex-1 text-text-2">{done.message}</span>
        {done.url && <Link href={done.url} className="shrink-0 font-medium underline-offset-4 hover:underline">Open</Link>}
      </article>
    );
  }

  return (
    <article aria-label={`Draft: ${title.slice(0, 40)}`} className="rounded-2xl border border-line bg-surface p-4">
      <header className="flex min-w-0 items-center gap-2 text-xs text-muted">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-medium text-text-2">
          {draft.via === "GitHub Actions" ? <GitMerge className="size-3" /> : <FileText className="size-3" />} {draft.via}
        </span>
        {draft.source && <span className="min-w-0 truncate">{draft.source}</span>}
        <span className="ml-auto shrink-0 text-faint">{timeAgo(draft.created_at)}</span>
      </header>
      <p className="mt-2 line-clamp-3 text-[15px] leading-snug font-medium">{!isPost && <BadgeCheck className="mr-1 inline size-4 -translate-y-px text-muted" aria-label="Milestone" />}{title}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{isPost ? "Post" : "Milestone"}{project && ` · ${project}`}</span>
        {!isPost && !!p.evidence?.length && <span className="inline-flex items-center gap-1"><Link2 className="size-3" />{p.evidence.length} {p.evidence.length === 1 ? "link" : "links"} as evidence</span>}
        <Link href="/drafts" className="inline-flex items-center gap-1 underline-offset-4 hover:text-text hover:underline"><PenLine className="size-3" />Edit</Link>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Decide this draft">
        {triageActions(draft.kind, clubs).map((a) => (
          <Button key={a.action} size="lg" variant={a.action === "keep" ? "primary" : a.action === "dismiss" ? "ghost" : "outline"} disabled={pending}
            aria-expanded={a.action === "sign" ? open === "sign" : a.action === "club" && clubs.length > 1 ? open === "club" : undefined}
            onClick={() => run(a.action)} className="w-full sm:w-auto">
            {pending && a.action === "keep" ? <Loader2 className="size-4 animate-spin" /> : null}{a.label}
          </Button>
        ))}
      </div>

      {open === "club" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Club</span>
            <select value={club} onChange={(e) => setClub(e.target.value)} className={cn(selectPillCls, "h-11 w-full")}>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Button size="lg" disabled={pending || !club} onClick={() => run("club")}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}{isPost ? "Post there" : "Send"}</Button>
        </div>
      )}
      {open === "sign" && (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); sendAsk(); }}>
          <p className="text-xs text-muted">It&apos;s kept on your project, and they get an email to sign it. Use their university or company address.</p>
          <label className="block"><span className="sr-only">Their email</span>
            <input type="email" inputMode="email" autoComplete="off" required placeholder="prof.lee@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputCls, "h-11")} />
          </label>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1"><span className="sr-only">How they know your work</span>
              <select value={rel} onChange={(e) => setRel(e.target.value)} className={cn(selectPillCls, "h-11 w-full")}>
                {Object.entries(RELATIONSHIPS).map(([k, v]) => <option key={k} value={k}>{v.replace(/^(a|an|their) /, "").replace(/^./, (c) => c.toUpperCase())}</option>)}
              </select>
            </label>
            <Button size="lg" type="submit" disabled={pending || !email.trim()}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}Send ask</Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </article>
  );
}
