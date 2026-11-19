"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// A "More" button for the actions a page keeps out of its main row (the profile header: review
// packet, preview, dashboard). `tour`: the product tour's target (lib/tours.ts) for the button. Closes on Escape, on a click outside, and when an item is chosen.
export type MoreItem = { href: string; label: string; icon?: React.ReactNode };

export function MoreMenu({ items, label = "More", className, tour }: { items: MoreItem[]; label?: string; className?: string; tour?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div ref={root} className={cn("relative", className)}>
      <button type="button" data-tour={tour} aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-text-2 transition hover:bg-hover hover:text-text active:scale-95">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
          {items.map((it) => (
            <Link key={it.href} href={it.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-2 transition hover:bg-hover hover:text-text [&_svg]:size-4 [&_svg]:text-muted">
              {it.icon}{it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
