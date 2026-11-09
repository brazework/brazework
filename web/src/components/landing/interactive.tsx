"use client";
import { useEffect } from "react";

export { CountUp } from "@/components/app/count-up";

// One listener for the whole page: whichever .spotlight card is under the cursor gets the
// cursor position as --mx/--my, which its ::before glow follows. Works for server-rendered cards.
export function SpotlightTracker() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".spotlight") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
  return null;
}
