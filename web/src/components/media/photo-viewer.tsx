"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

// The one pop-up for pictures (FIX-247): post photos (media-grid.tsx) and pictures attached to a project
// update (project-files.tsx) both open here, over the page, never in a new tab. It closes with ✕,
// Escape, a click on the dark backdrop, or a swipe down on a phone, and leaves you where you were:
// the page behind doesn't scroll, and focus goes back to the picture you opened. With more than one
// picture, arrows (keys, buttons or a sideways swipe) step through them, with "2 of 4".
export function PhotoViewer({ count, index, onIndex, onClose, label = "Photo viewer", caption, swipe = true, children }: {
  count: number;
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  label?: string;
  /** Alt text or a caption for the current picture, shown under it. */
  caption?: string;
  /** Swipe down to close, sideways to step. Off for a document, which scrolls. */
  swipe?: boolean;
  /** The current picture, drawn by the caller. */
  children: React.ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const open = index !== null;
  const go = useCallback((d: number) => { if (index !== null && count > 1) onIndex((index + d + count) % count); }, [index, count, onIndex]);

  // Remember what opened the viewer, move focus in, and put it back on close.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    close.current?.focus();
    return () => { const el = opener.current as HTMLElement | null; if (el?.isConnected) el.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      // Keep Tab inside the viewer.
      if (e.key === "Tab") {
        const root = close.current?.closest("[role=dialog]");
        const items = root ? [...root.querySelectorAll<HTMLElement>("button")] : [];
        if (items.length) {
          const i = items.indexOf(document.activeElement as HTMLElement);
          const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
          e.preventDefault();
          items[next].focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = [document.body.style.overflow, html.style.overflow];
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); [document.body.style.overflow, html.style.overflow] = prev; };
  }, [open, go, onClose]);

  // Swipes on a phone: sideways steps, down closes.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 1) start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; else start.current = null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose();
    else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          data-photo-viewer
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/92 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onTouchStart={swipe ? onTouchStart : undefined}
          onTouchEnd={swipe ? onTouchEnd : undefined}
        >
          <motion.div key={index} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-[min(92vw,1200px)] touch-pinch-zoom" onClick={(e) => e.stopPropagation()}>
            {children}
            {caption && <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/80">{caption}</p>}
          </motion.div>
          <button ref={close} type="button" onClick={onClose} aria-label="Close" className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"><X className="size-5" /></button>
          {count > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo" className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo" className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="size-5" /></button>
              <span aria-live="polite" className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] font-mono text-xs text-white/70">{(index ?? 0) + 1} of {count}</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
