"use client";
import { motion, useReducedMotion } from "motion/react";

const COLORS = ["var(--accent)", "#f59e0b", "#ec4899", "#22c55e", "#3b82f6", "#a855f7"];

// A one-off confetti burst from the middle of its parent (which needs `relative`).
// Positions come from the index, so it renders the same on the server and the client.
export function Celebrate({ pieces = 26 }: { pieces?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => {
        const a = (i / pieces) * Math.PI * 2 + (i % 3) * 0.3;
        const d = 70 + ((i * 37) % 60);
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + 40, opacity: 0, rotate: (i % 2 ? 1 : -1) * 220, scale: 0.6 }}
            transition={{ duration: 1.1 + (i % 4) * 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-1/2 left-1/2 h-2.5 w-1.5 rounded-[2px]"
            style={{ background: COLORS[i % COLORS.length] }}
          />
        );
      })}
    </span>
  );
}
