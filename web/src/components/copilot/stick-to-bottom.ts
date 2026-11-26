"use client";
import { useCallback, useEffect, useRef } from "react";

// Keeps the page scrolled to the end of a growing chat, but only while the reader is already there.
// A ResizeObserver catches every bit of growth (streamed words, a card fading in, link cards at the
// end), and the jump is instant, so it never fights a smooth scroll mid-flight. Scrolling up to
// re-read stops it; coming back to the bottom (or calling the returned function, as sending does)
// starts it again.
// `on`: only while there's a conversation to follow; an empty chat keeps its greeting in view.
export function useStickToBottom(ref: React.RefObject<HTMLElement | null>, on: boolean) {
  const stuck = useRef(true);
  const enabled = useRef(on);
  useEffect(() => { enabled.current = on; }, [on]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 96;
    let lastY = window.scrollY;
    const onScroll = () => {
      // Only the reader's own upward scroll lets go; our jumps (always down) never do.
      if (window.scrollY < lastY - 4) stuck.current = atBottom();
      else if (atBottom()) stuck.current = true;
      lastY = window.scrollY;
    };
    const ro = new ResizeObserver(() => {
      if (!stuck.current || !enabled.current) return;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior });
      lastY = window.scrollY;
    });
    ro.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [ref]);
  return useCallback(() => { stuck.current = true; }, []);
}
