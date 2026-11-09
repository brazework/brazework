"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/forge";

type Item = { id: string; label: string; count?: number; content: React.ReactNode };

const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };

// In-page tabs that slide between sections without a page load. The URL hash picks the tab
// (so /profile#projects still lands on Projects), and picking a tab updates the hash.
export function SwitchTabs({ items, name, className }: { items: Item[]; name: string; className?: string }) {
  const hash = useSyncExternalStore(subscribe, () => location.hash.slice(1), () => "");
  // The hash is the only source of truth; clicking a tab rewrites it (replaceState fires no event,
  // so a state bump re-reads it), and links like <a href="#posts"> switch tabs via hashchange.
  const [, rerender] = useState(0);
  const active = items.find((i) => i.id === hash)?.id ?? items[0].id;
  const current = items.find((i) => i.id === active)!;

  return (
    <div className={className}>
      <div role="tablist" aria-label={name} className="glass sticky top-16 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-2xl p-1 no-scrollbar md:top-3">
        {items.map((i) => (
          <button
            key={i.id}
            role="tab"
            id={`tab-${i.id}`}
            aria-selected={i.id === active}
            aria-controls={`panel-${i.id}`}
            onClick={() => { history.replaceState(null, "", `#${i.id}`); rerender((n) => n + 1); }}
            className={cn("relative inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-95", i.id === active ? "text-on-accent" : "text-muted hover:text-text")}
          >
            {i.id === active && <motion.span layoutId={`${name}-pill`} className="bg-accent-grad absolute inset-0 rounded-xl shadow-[0_6px_18px_-8px_var(--accent)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{i.label}</span>
            {i.count !== undefined && <span className={cn("relative rounded-full px-1.5 text-[11px] tabular-nums", i.id === active ? "bg-black/15" : "bg-raised")}>{i.count}</span>}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          {current.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
