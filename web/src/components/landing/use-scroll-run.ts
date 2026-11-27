"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// A section that pins and plays as you scroll (premium landing, 2026-11-27), the way the hero does.
// On a laptop with motion allowed, the section is taller than the screen, its inside sticks, and how
// far you've scrolled through it picks the step (`at`) and sets --p (0 to 1) and --seam on the
// section for CSS to follow. Anywhere else nothing pins: the steps are buttons (`go`), and --p
// follows the chosen step. Clicking a step while pinned scrolls to it, so the page and step agree.

const RUN = "(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";
const subscribe = (f: () => void) => { const m = matchMedia(RUN); m.addEventListener("change", f); return () => m.removeEventListener("change", f); };
export const usePinned = () => useSyncExternalStore(subscribe, () => matchMedia(RUN).matches, () => false);

export function useScrollRun(steps: number) {
  const pinned = usePinned();
  const run = useRef<HTMLElement>(null);
  const [at, setAt] = useState(0);
  const quietUntil = useRef(0);

  useEffect(() => {
    if (pinned) return;
    const p = String(steps > 1 ? at / (steps - 1) : 1);
    run.current?.style.setProperty("--p", p);
    run.current?.style.setProperty("--seam", String((at + 1) / steps));
  }, [pinned, at, steps]);

  useEffect(() => {
    if (!pinned) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = run.current;
      if (!el) return;
      const length = el.offsetHeight - innerHeight;
      const p = length > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / length)) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--seam", p.toFixed(4));
      if (performance.now() >= quietUntil.current) setAt(Math.min(steps - 1, Math.floor(p * steps)));
    };
    const on = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, [pinned, steps]);

  const go = useCallback((k: number) => {
    setAt(k);
    const el = run.current;
    if (!pinned || !el) return;
    const length = el.offsetHeight - innerHeight;
    quietUntil.current = performance.now() + 900;
    scrollTo({ top: el.getBoundingClientRect().top + scrollY + (length * (k + 0.5)) / steps, behavior: "smooth" });
  }, [pinned, steps]);

  return { run, pinned, at, go };
}
