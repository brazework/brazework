"use client";
import Lenis from "lenis";
import { useEffect } from "react";

// The landing page reads as one smooth scroll story on wide screens (Linear FIX-92): the wheel and
// trackpad glide instead of stepping, and the pinned sections (the fields, the projects, the agents,
// the globe) move through their steps as you scroll. Lenis drives the page's own scroll, so sticky
// sections, scroll-linked motion and in-page links keep working. No snapping: wherever a scroll comes
// to rest is where it stays (snapping pulled people back and felt like a fight).
// Off on phones (they have their own one-screen pages with native snapping) and for reduced motion.
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, autoRaf: true, anchors: { offset: -72 } });
    return () => lenis.destroy();
  }, []);
  return null;
}
