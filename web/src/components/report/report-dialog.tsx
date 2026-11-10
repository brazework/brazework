"use client";
import { Flag, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/forge";
import { fileReport, resolveReport, type ReportKind } from "@/lib/reports";

type Target = { kind: ReportKind; id: string; label: string };
const REASONS: [string, string][] = [
  ["spam", "Spam or scam"], ["misinformation", "Fake or misleading (e.g. someone else's work)"], ["harassment", "Harassment or bullying"],
  ["hate", "Hate"], ["sexual", "Sexual content"], ["violence", "Violence or threats"], ["other", "Something else"],
];

// Open the report dialog from anywhere: reportThis({ kind, id, label }).
export const reportThis = (t: Target) => window.dispatchEvent(new CustomEvent<Target>("forge:report", { detail: t }));

// One report dialog for the whole app, mounted in the layout.
export function ReportDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const open = (e: Event) => { setTarget((e as CustomEvent<Target>).detail); setReason(""); setDetail(""); setMsg(null); };
    window.addEventListener("forge:report", open);
    return () => window.removeEventListener("forge:report", open);
  }, []);
  useEffect(() => { if (target) ref.current?.showModal(); else ref.current?.close(); }, [target]);
  const send = () => start(async () => {
    if (!target) return;
    const r = await fileReport(target.kind, target.id, reason, detail);
    setMsg(r);
    if (r.ok) setTimeout(() => setTarget(null), 1400);
  });
  return (
    <dialog ref={ref} aria-label="Report" onCancel={(e) => { e.preventDefault(); setTarget(null); }} className="m-auto w-[min(480px,calc(100vw-24px))] rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-bg/70 backdrop:backdrop-blur-sm">
      {target && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Flag className="size-4" /> Report {target.label}</h2>
              <p className="mt-1 text-sm text-muted">Only the Brazework team sees reports. The person isn&apos;t told who reported them.</p>
            </div>
            <button type="button" onClick={() => setTarget(null)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">What&apos;s wrong?</legend>
            {REASONS.map(([id, label]) => (
              <label key={id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition", reason === id ? "border-text" : "border-line hover:bg-hover")}>
                <input type="radio" name="report-reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-[var(--accent)]" /> {label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Anything we should know? <span className="font-normal text-faint">(optional)</span></span>
            <textarea id="report-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} rows={3} className="rounded-2xl border border-line bg-surface-2/60 px-3 py-2 outline-none focus:border-line-strong" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={send} disabled={!reason || pending} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50">{pending && <Loader2 className="size-4 animate-spin" />} Send report</button>
            {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.message}</p>}
          </div>
        </div>
      )}
    </dialog>
  );
}

// A small "Report" link for server-rendered pages (profiles, projects, challenges).
export function ReportLink({ kind, id, label, className }: Target & { className?: string }) {
  return (
    <button type="button" onClick={() => reportThis({ kind, id, label })} className={cn("inline-flex items-center gap-1 text-xs text-faint transition hover:text-text", className)}>
      <Flag className="size-3.5" /> Report
    </button>
  );
}

// Brazework admins: resolve a report from /admin.
export function ResolveReport({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (s: "actioned" | "dismissed") => start(async () => { const r = await resolveReport(id, s); setMsg(r.ok ? "" : r.message); });
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run("actioned")} className="h-8 rounded-full bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-50">Actioned</button>
      <button type="button" disabled={pending} onClick={() => run("dismissed")} className="h-8 rounded-full border border-line px-3 text-xs disabled:opacity-50 hover:bg-hover">Dismiss</button>
      {msg && <span role="alert" className="text-xs text-danger">{msg}</span>}
    </span>
  );
}
