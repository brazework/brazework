"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// A row of tabs that may be wider than a phone: the current tab is scrolled into view (Manage has ten
// tabs, and "Roles" sat off screen with nothing looking selected), and an edge fades where there are
// more tabs to swipe to. The first render has no fade, so the server HTML and hydration match.
export function TabRow({ active, className, children }: { active: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = el.querySelector<HTMLElement>('[aria-current="page"]');
    // Only the row scrolls (scrollIntoView could also scroll the page).
    if (on && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
    const update = () => setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [active]);
  const fade = !edge.start || !edge.end;
  return (
    <nav
      ref={ref}
      className={cn("relative", className)}
      style={fade ? { maskImage: `linear-gradient(90deg, ${edge.start ? "#000" : "transparent"}, #000 28px, #000 calc(100% - 28px), ${edge.end ? "#000" : "transparent"})` } : undefined}
    >
      {children}
    </nav>
  );
}
