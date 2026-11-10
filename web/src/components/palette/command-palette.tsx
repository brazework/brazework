"use client";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Building2, CalendarDays, FolderGit2, MessageSquare, PenLine, Search, Settings, Sparkles, UserRound, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// ⌘K (Ctrl+K) from anywhere: jump to a place, start something, search, or ask Ember. Ember isn't a
// page you visit; it's a keystroke away, with what you typed.
type Item = { id: string; label: string; hint?: string; icon: typeof Search; run: () => void };

export function CommandPalette() {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("forge:palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("forge:palette", onOpen); };
  }, []);
  // Fresh each time it opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) { setWasOpen(open); if (open) { setQ(""); setI(0); } }
  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);

  const go = (href: string) => () => { setOpen(false); router.push(href); };
  const items = useMemo<Item[]>(() => {
    const text = q.trim();
    const actions: Item[] = [
      { id: "post", label: "New post", hint: "What are you building?", icon: PenLine, run: () => { setOpen(false); if (path === "/feed") window.dispatchEvent(new Event("forge:compose")); else router.push("/feed#composer"); } },
      { id: "project", label: "Add a project", icon: FolderGit2, run: go("/projects") },
      { id: "verify", label: "Ask your club to verify a milestone", icon: BadgeCheck, run: go("/projects") },
      { id: "clubs", label: "Find a club", icon: Users, run: go("/communities?tab=discover") },
      { id: "events", label: "Events", icon: CalendarDays, run: go("/events") },
      { id: "talent", label: "Find builders by verified work", hint: "For verified companies and schools", icon: Building2, run: go("/talent") },
      { id: "messages", label: "Messages", icon: MessageSquare, run: go("/messages") },
      { id: "profile", label: "Your profile", icon: UserRound, run: go("/profile") },
      { id: "settings", label: "Settings", icon: Settings, run: go("/settings") },
    ];
    const match = text ? actions.filter((a) => a.label.toLowerCase().includes(text.toLowerCase())) : actions;
    const typed: Item[] = text ? [
      { id: "ask", label: `Ask Ember: "${text}"`, hint: "Your AI teammate checks Forge and drafts it for you", icon: Sparkles, run: go(`/copilot?q=${encodeURIComponent(text)}`) },
      { id: "search", label: `Search Forge for "${text}"`, hint: "People, clubs, projects, events", icon: Search, run: go(`/search?q=${encodeURIComponent(text)}`) },
    ] : [{ id: "ask-empty", label: "Ask Ember anything", hint: "Plan a meeting, draft an update, find people", icon: Sparkles, run: go("/copilot") }];
    return [...typed, ...match];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, path]);
  const sel = Math.min(i, items.length - 1);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div role="dialog" aria-modal="true" aria-label="Ask Ember or jump anywhere" onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Sparkles className="size-5 shrink-0 text-accent" />
              <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => (v + 1) % items.length); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => (v - 1 + items.length) % items.length); }
                  if (e.key === "Enter") { e.preventDefault(); items[sel]?.run(); }
                }}
                placeholder="Ask Ember, search, or jump anywhere…" aria-label="Ask Ember, search, or jump anywhere" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[sel] ? `pal-${items[sel].id}` : undefined}
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint" />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">esc</kbd>
            </div>
            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {items.map((it, n) => (
                <li key={it.id} id={`pal-${it.id}`} role="option" aria-selected={n === sel}>
                  <button type="button" onMouseEnter={() => setI(n)} onClick={it.run} className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition", n === sel ? "bg-hover" : "")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", it.id.startsWith("ask") ? "bg-accent-grad text-on-accent" : "bg-surface-2 text-text-2")}><it.icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{it.label}</span>
                      {it.hint && <span className="block truncate text-xs text-muted">{it.hint}</span>}
                    </span>
                    {n === sel && <kbd className="font-mono text-[10px] text-faint">↵</kbd>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
