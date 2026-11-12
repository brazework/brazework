"use client";
import Lenis from "lenis";
import Snap from "lenis/snap";
import { useEffect } from "react";

// The landing page reads as one smooth scroll story on wide screens (Linear FIX-92): the wheel and
// trackpad glide instead of stepping, and the pinned sections (the fields, the agents) move through
// their chapters in step. Lenis drives the page's own scroll, so sticky sections, scroll-linked
// motion and in-page links keep working.
// Snapping: when a scroll comes to rest near the start of a section (or, in a pinned section, near
// one of its chapters, marked by data-chapters), it settles there. Rest far from any of them, in the
// middle of a long section, and it stays put, so nothing is ever cut off.
// Off on phones (they have their own one-screen pages with native snapping) and for reduced motion.
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.09, autoRaf: true, anchors: { offset: -72 } });
    const snap = new Snap(lenis, { type: "proximity", distanceThreshold: "28%", duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 4), debounce: 160 });
    let points: (() => void)[] = [];
    const build = () => {
      points.forEach((remove) => remove());
      points = [];
      for (const el of document.querySelectorAll<HTMLElement>("main .story-sec")) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        const n = Number(el.dataset.chapters ?? 0);
        if (n > 1) {
          // The same spots the chapter tabs scroll to.
          const travel = el.offsetHeight - window.innerHeight;
          for (let i = 0; i < n; i++) points.push(snap.add(top + travel * ((i + 0.08) / n)));
        } else points.push(snap.add(top));
      }
    };
    build();
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(build, 200); });
    ro.observe(document.body);
    return () => { clearTimeout(t); ro.disconnect(); snap.destroy(); lenis.destroy(); };
  }, []);
  return null;
}
