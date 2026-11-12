"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronDown, Rocket, Sparkles } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/forge";
import { UPDATES, updateDate } from "@/lib/tours";
import { FeedbackForm } from "./feedback-form";
import { UpdatesDialog } from "./tour-mount";

const RECENT = UPDATES.filter((u) => u.kind !== "Next").slice(0, 4);
const UPCOMING = UPDATES.filter((u) => u.kind === "Next").slice(0, 4);

const TABS = [["recent", "Recent"], ["upcoming", "Next"], ["feedback", "Feedback"]] as const;
type Tab = (typeof TABS)[number][0];

// Folded or open, remembered per browser (a convenience: if storage is unavailable it just opens).
const FOLD_KEY = "forge-updates-folded";
const foldSubs = new Set<() => void>();
const readFolded = () => { try { return localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; } };
function useFolded() {
  const folded = useSyncExternalStore((f) => { foldSubs.add(f); return () => { foldSubs.delete(f); }; }, readFolded, () => false);
  const set = (v: boolean) => { try { if (v) localStorage.setItem(FOLD_KEY, "1"); else localStorage.removeItem(FOLD_KEY); } catch {} foldSubs.forEach((f) => f()); };
  return [folded, set] as const;
}

// Brazework updates at the top right of the feed: what changed recently, what's coming next, and a
// place to tell us what to build. Each update opens its full note. The header folds it to one line.
export function UpdatesPanel() {
  const [tab, setTab] = useState<Tab>("recent");
  const [open, setOpen] = useState<string | null>(null);
  const [folded, setFolded] = useFolded();
  const list = tab === "recent" ? RECENT : UPCOMING;

  return (
    <section data-tour="updates-panel" aria-labelledby="updates-panel-title" className="glass-card relative overflow-hidden rounded-3xl p-4">
      <div className="relative flex items-center gap-2">
        <button type="button" onClick={() => setFolded(!folded)} aria-expanded={!folded} aria-controls="updates-panel-body" className="group -m-1 flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-grad text-on-accent"><Sparkles className="size-3.5" /></span>
          <span className="min-w-0">
            <h2 id="updates-panel-title" className="text-sm font-semibold">Brazework updates</h2>
            {folded && RECENT[0] && <span className="block truncate text-xs text-muted">Latest: {RECENT[0].title}</span>}
          </span>
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-faint transition group-hover:text-text", !folded && "rotate-180")} />
        </button>
        {!folded && <button type="button" onClick={() => setOpen("")} className="shrink-0 text-xs text-muted hover:text-text">See all</button>}
      </div>

      <AnimatePresence initial={false}>
      {!folded && (
      <motion.div id="updates-panel-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">

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
      // The panel wraps the list (a <ul> with a tab role stops being a list to screen readers).
      <div role="tabpanel" aria-label={tab === "recent" ? "Recent changes" : "Coming next"} className="relative mt-2">
      <ul className="flex flex-col">
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
      </div>
      )}
      </motion.div>
      )}
      </AnimatePresence>

      <UpdatesDialog open={open !== null} onClose={() => setOpen(null)} focusId={open || undefined} />
    </section>
  );
}
