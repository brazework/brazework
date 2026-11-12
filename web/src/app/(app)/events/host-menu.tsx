"use client";
import { AnimatePresence, motion } from "motion/react";
import { Building2, ChevronDown, Plus, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuCls, menuItemCls } from "@/components/ui";
import { cn } from "@/lib/forge";

// "Host an event": straight to the right place. Club officers host from their club's Events tab,
// organization admins from /org, and Ember can draft the whole thing for an officer to approve.
export function HostMenu({ clubs, orgAdmin }: { clubs: { id: string; name: string }[]; orgAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", shut);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); window.removeEventListener("resize", shut); };
  }, [open]);

  const item = cn(menuItemCls, "gap-3 py-2.5");
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          // The page header clips overflow, so the menu is portalled to <body> and placed under the button.
          const r = ref.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + window.scrollY + 8, right: Math.max(16, window.innerWidth - r.right) });
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent shadow-[var(--shadow)] transition hover:opacity-90"
      >
        <Plus className="size-4" /> Host an event <ChevronDown className="size-3.5 opacity-70" />
      </button>
      {typeof document !== "undefined" && createPortal(<AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn(menuCls, "absolute z-50 w-72 max-w-[calc(100vw-32px)]")}
          >
            {clubs.map((c) => (
              <Link key={c.id} role="menuitem" href={`/c/${c.id}?tab=events`} className={item} onClick={() => setOpen(false)}>
                <UsersRound className="size-4 shrink-0 text-text-2" />
                <span className="min-w-0 flex-1"><span className="block truncate">For {c.name}</span><span className="block text-xs text-faint">Members see it first</span></span>
              </Link>
            ))}
            {clubs.length > 0 && (
              <Link role="menuitem" href={`/copilot?q=${encodeURIComponent(`Plan our next ${clubs[0].name} event: suggest a date, a title and a description`)}`} className={item} onClick={() => setOpen(false)}>
                <Sparkles className="size-4 shrink-0 text-text-2" />
                <span className="min-w-0 flex-1"><span className="block">Plan it with Ember</span><span className="block text-xs text-faint">Ember drafts it, you approve</span></span>
              </Link>
            )}
            <Link role="menuitem" href="/org" className={item} onClick={() => setOpen(false)}>
              <Building2 className="size-4 shrink-0 text-text-2" />
              <span className="min-w-0 flex-1"><span className="block">{orgAdmin ? "For your organization" : "As a company or school"}</span><span className="block text-xs text-faint">{orgAdmin ? "Career fairs, talks, info sessions" : "Verify your organization first"}</span></span>
            </Link>
            {!clubs.length && <p className="px-3 pt-1 pb-2 text-xs text-faint">Club admins and owners host from their club&apos;s Events tab.</p>}
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}
