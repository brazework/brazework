"use client";
import { Check, Search, Send } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { SEARCH_TRIES, searchBuilders } from "@/lib/landing-demo";

// The company side, to try: search the way a recruiter does, by the work. Every result is signed
// work with who signed it, and "Message" shows what really happens: a request the builder can
// accept or decline. Example people (lib/landing-demo.ts).
export function CompanySearch() {
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const found = searchBuilders(q);
  // Three at a time, so the list never needs a scrollbar of its own.
  const shown = found.slice(0, 3), more = found.length - shown.length;
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[var(--shadow-float)]">
      <div className="border-b border-line p-4 sm:p-5">
        <label htmlFor="company-q" className="text-sm font-semibold">Find builders</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input id="company-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} autoComplete="off" placeholder="A tool, a skill, a result"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-10 text-[16px] transition outline-none placeholder:text-faint focus:border-text focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_9%,transparent)]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Try</span>
          {SEARCH_TRIES.map((t) => (
            <button key={t} type="button" onClick={() => setQ(q === t ? "" : t)} aria-pressed={q === t}
              className={cn("inline-flex h-8 items-center rounded-lg border px-3 text-sm transition", q === t ? "border-text bg-accent text-on-accent" : "border-line text-text-2 hover:border-line-strong")}>{t}</button>
          ))}
        </div>
      </div>
      <div className="bg-bg p-3 sm:p-4 lg:min-h-[31rem]">
        <p className="px-1 pb-2.5 text-xs text-muted" aria-live="polite">{found.length === 0 ? "Nobody yet" : `${found.length} ${found.length === 1 ? "person" : "people"}`} with signed work{q.trim() ? ` matching "${q.trim()}"` : ""}</p>
        {found.length === 0 && <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">No signed work matches that. Only work somebody verified shows up here, so there&apos;s nothing to pad the list with.</p>}
        <ul className="flex flex-col gap-2.5">
          {shown.map((b) => {
            const asked = sent.includes(b.id);
            return (
              <li key={b.id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-2">{b.initials}</span>
                  <p className="min-w-0 flex-1 text-sm leading-tight"><span className="font-medium">{b.name}</span><span className="mt-0.5 block text-xs text-muted">{b.role}</span></p>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))] px-2 py-1 text-xs font-medium text-ok"><Check className="size-3.5" /> {b.signed.length} signed</span>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {b.signed.map((s) => <li key={s.title} className="rounded-lg bg-surface-2/70 px-3 py-2 text-sm"><span className="font-medium">{s.title}</span><span className="block text-xs text-muted">Verified by {s.by}, {s.club}, {s.when}</span></li>)}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">{asked ? "Request sent. It waits in their Requests until they accept." : b.open}</p>
                  <button type="button" disabled={asked} onClick={() => setSent((v) => [...v, b.id])} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium transition hover:border-line-strong hover:bg-hover disabled:pointer-events-none disabled:text-muted">
                    {asked ? <Check className="size-4" /> : <Send className="size-4" />} {asked ? "Sent" : "Message"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="px-1 pt-3 text-xs text-faint">{more > 0 ? `And ${more} more. Search to narrow it down. ` : ""}Example people and work.</p>
      </div>
    </div>
  );
}
