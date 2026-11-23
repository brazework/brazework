"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

function cardSpacing(row: HTMLElement) {
  const [first, second] = Array.from(row.children);
  return first && second ? second.getBoundingClientRect().left - first.getBoundingClientRect().left : 0;
}

export function SwipeControls({ rowId, count, hint }: { rowId: string; count: number; hint: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const row = document.getElementById(rowId);
    if (!row) return;

    function update() {
      if (!row) return;
      const spacing = cardSpacing(row);
      setCurrent(spacing > 0 ? Math.max(0, Math.min(count - 1, Math.round(row.scrollLeft / spacing))) : 0);
    }

    const resize = new ResizeObserver(update);
    resize.observe(row);
    row.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      row.removeEventListener("scroll", update);
    };
  }, [count, rowId]);

  function move(direction: -1 | 1) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    row.scrollTo({ left: (current + direction) * cardSpacing(row), behavior });
  }

  const button = "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-text-2 disabled:opacity-40";

  return (
    <div className="mt-4 flex items-center justify-between gap-2 md:hidden">
      <p className="text-xs text-muted">{hint}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" aria-label="Previous card" aria-controls={rowId} disabled={current === 0} onClick={() => move(-1)} className={button}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <span aria-live="polite" className="text-xs whitespace-nowrap text-muted tabular-nums">{current + 1} of {count}</span>
        <button type="button" aria-label="Next card" aria-controls={rowId} disabled={current === count - 1} onClick={() => move(1)} className={button}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
