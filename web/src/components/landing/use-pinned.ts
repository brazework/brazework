"use client";
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

// A pinned story section (Linear FIX-92): on wide screens the section is several screens tall with
// its content held in place (sticky), and how far you've scrolled through it picks the step. `at` is
// the step, `fill` how far through it (0–1), `goTo(i)` scrolls to a step (tabs and arrows use it).
// The section carries data-chapters={n}, the step count. Phones have their
// own one-screen pages, so there `wide` is false and the component runs its own clock instead.
// onStep(next, prev) is called from the scroll itself when the step changes.
export function usePinned(ref: RefObject<HTMLElement | null>, n: number, onStep?: (next: number, prev: number) => void) {
  const [wide, setWide] = useState(false);
  const [at, setAt] = useState(0);
  const [fill, setFill] = useState(0);
  const reduce = useReducedMotion();
  const last = useRef(0);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const section = () => ref.current?.closest("section") ?? null;
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", () => {
    const el = section();
    if (!wide || !el) return;
    const r = el.getBoundingClientRect();
    const v = Math.min(0.9999, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight))) * n;
    const step = Math.floor(v);
    if (step !== last.current) { onStep?.(step, last.current); last.current = step; }
    setAt(step);
    setFill(v - step);
  });
  const goTo = (i: number) => {
    const el = section();
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * ((i + 0.08) / n), behavior: reduce ? "auto" : "smooth" });
  };
  return { wide, at, fill, goTo };
}
