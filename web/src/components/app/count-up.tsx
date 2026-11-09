"use client";
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

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
