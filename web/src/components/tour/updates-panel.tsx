"use client";
import { ArrowRight, Rocket, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { UPDATES, updateDate } from "@/lib/tours";
import { FeedbackForm } from "./feedback-form";
import { UpdatesDialog } from "./tour-mount";

const RECENT = UPDATES.filter((u) => u.kind !== "Next").slice(0, 4);
const UPCOMING = UPDATES.filter((u) => u.kind === "Next").slice(0, 4);

const TABS = [["recent", "Recent"], ["upcoming", "Next"], ["feedback", "Feedback"]] as const;
type Tab = (typeof TABS)[number][0];

// Forge updates at the top right of the feed: what changed recently, what's coming next, and a
// place to tell us what to build. Each update opens its full note.
export function UpdatesPanel() {
  const [tab, setTab] = useState<Tab>("recent");
  const [open, setOpen] = useState<string | null>(null);
  const list = tab === "recent" ? RECENT : UPCOMING;

  return (
    <section data-tour="updates-panel" aria-labelledby="updates-panel-title" className="relative overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <div className="bg-accent-grad pointer-events-none absolute -top-16 -right-10 size-36 rounded-full banner-glow blur-2xl" aria-hidden="true" />
      <div className="relative flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-accent-grad text-on-accent"><Sparkles className="size-3.5" /></span>
        <h2 id="updates-panel-title" className="text-sm font-semibold">Forge updates</h2>
        <button type="button" onClick={() => setOpen("")} className="ml-auto text-xs text-muted hover:text-text">See all</button>
      </div>

      <div role="tablist" aria-label="Updates" className="relative mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            data-tour={t === "feedback" ? "feedback-tab" : undefined}
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("rounded-lg py-1.5 text-xs font-medium transition", tab === t ? "bg-surface text-text shadow-[var(--shadow)]" : "text-muted hover:text-text")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "feedback" ? (
        <div role="tabpanel" aria-label="Send feedback" className="relative mt-3"><FeedbackForm compact /></div>
      ) : (
      <ul role="tabpanel" aria-label={tab === "recent" ? "Recent changes" : "Coming next"} className="relative mt-2 flex flex-col">
        {list.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => setOpen(u.id)} className="group flex w-full items-start gap-3 rounded-xl px-1.5 py-2 text-left transition hover:bg-hover">
              {u.kind === "Next" ? (
                <Rocket className="mt-0.5 size-4 shrink-0 text-faint" />
              ) : (
                <span className={cn("mt-1 shrink-0 rounded-full px-1.5 py-px font-mono text-[9px] tracking-wide uppercase", u.kind === "New" ? "bg-accent-grad text-on-accent" : "border border-line text-muted")}>{u.kind}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug font-medium group-hover:text-text">{u.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{u.summary}</span>
                {u.date && <span className="mt-0.5 block text-[11px] text-faint">{updateDate(u)}</span>}
              </span>
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
      )}

      <UpdatesDialog open={open !== null} onClose={() => setOpen(null)} focusId={open || undefined} />
    </section>
  );
}
