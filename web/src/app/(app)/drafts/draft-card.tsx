"use client";
import { BadgeCheck, Check, FileText, GitMerge, Link2, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, inputCls } from "@/components/ui";
import { cn, timeAgo } from "@/lib/forge";
import { approveDraft, dismissDraft, type ToolDraft } from "@/lib/tool-drafts";

const KIND: Record<string, string> = { update: "Update", result: "Result", question: "Question" };

// One draft: where it came from, what it will become, editable, then Post or Dismiss.
export function DraftCard({ draft, project, club }: { draft: ToolDraft; project: string | null; club: string | null }) {
  const p = draft.payload;
  const isPost = draft.kind === "post";
  const [body, setBody] = useState(p.body ?? "");
  const [title, setTitle] = useState(p.title ?? "");
  const [detail, setDetail] = useState(p.detail ?? "");
  const [done, setDone] = useState<{ message: string; url?: string; dismissed?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const label = isPost ? `${KIND[p.kind ?? "update"] ?? "Update"} post` : club ? `Milestone for ${club} to verify` : "Milestone (waits for someone to vouch)";

  const approve = () => start(async () => {
    setError("");
    const r = await approveDraft(draft.id, isPost ? { body } : { title, detail });
    if (r.ok) setDone({ message: r.message, url: r.url }); else setError(r.message);
  });
  const dismiss = () => start(async () => {
    setError("");
    const r = await dismissDraft(draft.id);
    if (r.ok) setDone({ message: r.message, dismissed: true }); else setError(r.message);
  });

  if (done) {
    return (
      <article aria-label={`Draft: ${isPost ? body.slice(0, 40) : title}`} className="glass-card flex items-center gap-3 rounded-3xl p-4 text-sm">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", done.dismissed ? "bg-surface-2 text-muted" : "bg-ok text-white")}>{done.dismissed ? <X className="size-3.5" /> : <Check className="size-3.5" />}</span>
        <span role="status" className="flex-1 text-text-2">{done.message}</span>
        {done.url && <Link href={done.url} className="font-medium underline-offset-4 hover:underline">Open</Link>}
      </article>
    );
  }

  return (
    <article aria-label={`Draft: ${isPost ? body.slice(0, 40) : title}`} className="glass-card rounded-3xl p-5">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-medium text-text-2">
          {draft.via === "GitHub Actions" ? <GitMerge className="size-3" /> : <FileText className="size-3" />} via {draft.via}
        </span>
        {draft.source && <span className="truncate">{draft.source}</span>}
        <span className="ml-auto text-faint">{timeAgo(draft.created_at)}</span>
      </header>
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">{!isPost && <BadgeCheck className="size-4 text-muted" />}{label}{project && <span className="font-normal text-muted"> · {project}</span>}</p>

      {isPost ? (
        <label className="mt-3 block">
          <span className="sr-only">Post</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={Math.min(8, Math.max(3, Math.ceil(body.length / 70)))} className={cn(inputCls, "h-auto py-2.5 leading-relaxed")} />
        </label>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block"><span className="text-xs text-muted">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={cn(inputCls, "mt-1")} /></label>
          <label className="block"><span className="text-xs text-muted">How it was done and measured</span><textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={600} rows={2} className={cn(inputCls, "mt-1 h-auto py-2")} /></label>
          {!!p.evidence?.length && (
            <ul className="space-y-1 pt-1" aria-label="Evidence">
              {p.evidence.map((e) => (
                <li key={e.url} className="flex min-w-0 items-center gap-1.5 text-xs text-text-2"><Link2 className="size-3 shrink-0 text-muted" /><a href={e.url} target="_blank" rel="noreferrer noopener" className="truncate underline-offset-4 hover:underline">{e.url.replace(/^https:\/\//, "")}</a></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {isPost && !!p.tags?.length && <p className="mt-2 text-xs text-muted">{p.tags.map((t) => `#${t}`).join(" ")}</p>}

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={approve} disabled={pending || (isPost ? !body.trim() : !title.trim())}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{isPost ? "Post" : club ? "Send to club" : "Log it"}</Button>
        <Button variant="ghost" onClick={dismiss} disabled={pending}>Dismiss</Button>
      </div>
    </article>
  );
}
