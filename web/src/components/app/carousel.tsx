"use client";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "@/lib/forge";

// A horizontal strip of cards: swipe or scroll on touch and trackpads, drag with a mouse, or use
// the arrows. Cards snap into place, and the edges fade when there's more to see.
export function Carousel({ title, icon, href, hrefLabel = "See all", children, className }: { title: string; icon?: React.ReactNode; href?: string; hrefLabel?: string; children: React.ReactNode; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  const by = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className={cn("min-w-0", className)} aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="bg-accent-grad grid size-7 place-items-center rounded-lg text-on-accent">{icon}</span>}
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <span className="ml-auto flex items-center gap-1">
          {href && <Link prefetch={false} href={href} className="mr-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text">{hrefLabel} <ArrowRight className="size-3.5" /></Link>}
          <button type="button" onClick={() => by(-1)} disabled={edge.start} aria-label="Scroll back" className="hidden size-8 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-text active:scale-90 disabled:opacity-30 sm:grid"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => by(1)} disabled={edge.end} aria-label="Scroll forward" className="hidden size-8 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-text active:scale-90 disabled:opacity-30 sm:grid"><ChevronRight className="size-4" /></button>
        </span>
      </div>
      <div className="relative">
        <div
          ref={track}
          onScroll={update}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse" || !track.current) return;
            drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
          }}
          // Cards are links and images, which the browser would otherwise start dragging natively.
          onDragStart={(e) => e.preventDefault()}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || !track.current) return;
            const dx = e.clientX - d.x;
            // Smooth scrolling and snapping would fight the cursor, so both pause while dragging.
            if (Math.abs(dx) > 5 && !d.moved) { d.moved = true; track.current.style.scrollSnapType = "none"; track.current.style.scrollBehavior = "auto"; track.current.setPointerCapture(e.pointerId); }
            if (d.moved) track.current.scrollLeft = d.left - dx;
          }}
          onPointerUp={() => { if (track.current) { track.current.style.scrollSnapType = ""; track.current.style.scrollBehavior = ""; } setTimeout(() => { drag.current = null; }, 0); }}
          onPointerLeave={() => { if (track.current) { track.current.style.scrollSnapType = ""; track.current.style.scrollBehavior = ""; } drag.current = null; }}
          // A drag shouldn't count as a click on the card under the cursor.
          onClickCapture={(e) => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pt-1 pb-6 -mb-3 [&>*]:shrink-0 [&>*]:snap-start"
          // Fade the cards themselves at an edge with more to see (a mask works over any background).
          style={{ maskImage: `linear-gradient(90deg, ${edge.start ? "#000" : "transparent"}, #000 48px, #000 calc(100% - 48px), ${edge.end ? "#000" : "transparent"})` }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
