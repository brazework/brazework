"use client";
import { Loader2, PenLine } from "lucide-react";
import { useState, useTransition } from "react";
import { requestProjectSignoff } from "@/lib/vouches";
import { RELATIONSHIPS } from "@/lib/vouch-email";

// Get the project signed off (Linear FIX-227): pick its results, one person who saw them, one email.
// They sign each result they saw on one page, and only those (lib/vouch-ask.ts askProjectSignoff).
export function ProjectSignoff({ projectId, results, done }: { projectId: string; results: { id: string; title: string }[]; done: boolean }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(results.slice(0, 5).map((r) => r.id)));
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("manager");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 5) n.add(id); return n; });
  const send = () => start(async () => {
    const r = await requestProjectSignoff(projectId, [...picked], email.trim(), relationship);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) setOpen(false);
  });
  if (msg?.ok) return <p role="status" className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-text-2">{msg.text}</p>;
  return (
    <section aria-labelledby="signoff-h" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="signoff-h" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"><PenLine className="size-4 text-muted" /> {done ? "Get this project signed off" : "Get several results signed at once"}</h2>
          <p className="mt-1 text-sm text-muted">One email to the person who saw the work. They sign each result they saw, on one page.</p>
        </div>
        {!open && <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 shrink-0 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent transition hover:opacity-90">Ask for a sign-off</button>}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <fieldset>
            <legend className="text-xs font-medium text-muted">Results to sign (up to 5)</legend>
            <ul className="mt-1.5 space-y-1.5">
              {results.map((r) => (
                <li key={r.id}><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="mt-0.5 size-4 accent-[var(--text)]" /><span>{r.title}</span></label></li>
              ))}
            </ul>
          </fieldset>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="text-xs text-muted">Their email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="mt-1 block h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-text outline-none focus:border-line-strong" /></label>
            <label className="text-xs text-muted">They&apos;re<select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-line bg-surface px-2 text-[15px] text-text">
              {Object.entries(RELATIONSHIPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          </div>
          <p className="text-xs text-muted">A work or university address carries the most weight; a personal one works too, and the signature says which kind it came from.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending || picked.size < 2 || !email.includes("@")} onClick={send} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-40">
              {pending && <Loader2 className="size-4 animate-spin" />} Send one email for {picked.size} results
            </button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted hover:text-text">Not now</button>
          </div>
          {msg && !msg.ok && <p role="alert" className="text-sm text-danger">{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
