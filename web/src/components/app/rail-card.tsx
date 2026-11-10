"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/forge";

// Folded or open, remembered per card and per browser (a convenience: if storage is unavailable
// every card just opens). The server renders cards open; the browser applies what you chose.
const subs = new Set<() => void>();
const keyFor = (id: string) => `forge-rail-folded:${id}`;
export function useFold(id: string) {
  const folded = useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => { try { return localStorage.getItem(keyFor(id)) === "1"; } catch { return false; } },
    () => false,
  );
  const set = (v: boolean) => {
    try { if (v) localStorage.setItem(keyFor(id), "1"); else localStorage.removeItem(keyFor(id)); } catch {}
    subs.forEach((f) => f());
  };
  return [folded, set] as const;
}

export const foldMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
};

// A right-rail card whose header folds it to one line. `summary` shows in the header while folded,
// so a folded card still says something useful ("2 open · next in 3 days").
export function RailCard({ id, title, icon, href, linkLabel = "See all", summary, badge, children, className }: {
  id: string; title: string; icon: React.ReactNode; href?: string; linkLabel?: string; summary?: string; badge?: number;
  children: React.ReactNode; className?: string;
}) {
  const [folded, setFolded] = useFold(id);
  const body = `rail-${id}-body`;
  return (
    <section aria-labelledby={`rail-${id}-title`} className={cn("glass-card rounded-3xl p-4", className)}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setFolded(!folded)} aria-expanded={!folded} aria-controls={body} className="group -m-1 flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-grad text-on-accent">{icon}</span>
          <span className="min-w-0">
            <h2 id={`rail-${id}-title`} className="flex items-center gap-1.5 text-sm font-semibold">
              {title}
              {!!badge && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent tabular-nums">{badge}</span>}
            </h2>
            {folded && summary && <span className="block truncate text-xs text-muted">{summary}</span>}
          </span>
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-faint transition group-hover:text-text", !folded && "rotate-180")} />
        </button>
        {!folded && href && <Link href={href} className="shrink-0 text-xs text-muted hover:text-text">{linkLabel}</Link>}
      </div>
      <AnimatePresence initial={false}>
        {!folded && <motion.div id={body} {...foldMotion} className="overflow-hidden">{children}</motion.div>}
      </AnimatePresence>
    </section>
  );
}
