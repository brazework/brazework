"use client";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// A number that counts up the first time it comes into view (Linear FIX-92). It renders the real
// number first (so the page, search engines and no-JS visitors always see the truth), then replays
// from `from` once, easing out. Fixed-width digits and a minimum width, so nothing shifts while it
// counts. Reduced motion: just the number.
export function CountUp({ to, from = 0, duration = 1100, className }: { to: number; from?: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(to);
  useEffect(() => {
    if (!seen || reduce || from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setN(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, reduce, from, to, duration]);
  return <span ref={ref} className={className} style={{ display: "inline-block", minWidth: `${to.toLocaleString("en-US").length}ch`, fontVariantNumeric: "tabular-nums" }}>{n.toLocaleString("en-US")}</span>;
}
