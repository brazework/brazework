"use client";
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

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

// Counts up to `to` the first time it scrolls into view. The final number is in the HTML,
// so it's correct without JavaScript and for screen readers.
export function CountUp({ to, decimals = 0, prefix = "", suffix = "" }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!inView || reduce || !el) return;
    const controls = animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`; } });
    return () => controls.stop();
  }, [inView, reduce, to, decimals, prefix, suffix]);
  return <span ref={ref} className="tabular-nums">{prefix}{to.toFixed(decimals)}{suffix}</span>;
}
