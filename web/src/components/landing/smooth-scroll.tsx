"use client";
import Lenis from "lenis";
import { useEffect } from "react";

// The landing page reads as one smooth scroll story on wide screens (Linear FIX-92): the wheel and
// trackpad glide instead of stepping, and the pinned sections (the fields, the agents) move through
// their chapters in step. Lenis drives the page's own scroll, so sticky sections, scroll-linked
// motion and in-page links keep working. Off on phones (they have their own one-screen pages with
// native snapping) and for anyone who asks for reduced motion.
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.09, autoRaf: true, anchors: { offset: -72 } });
    return () => lenis.destroy();
  }, []);
  return null;
}
