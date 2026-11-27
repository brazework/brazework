"use client";
import { cn } from "@/lib/forge";

// A card that leans toward the pointer a few degrees and catches the light (premium landing,
// 2026-11-27; globals.css .tilt). Mouse only; still with reduced motion.
export function Tilt({ as: Tag = "div", className, children }: { as?: "div" | "li"; className?: string; children: React.ReactNode }) {
  const move = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    e.currentTarget.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
    e.currentTarget.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
    e.currentTarget.style.setProperty("--mx", `${x * 100}%`);
    e.currentTarget.style.setProperty("--my", `${y * 100}%`);
  };
  const leave = (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.style.setProperty("--rx", "0deg"); e.currentTarget.style.setProperty("--ry", "0deg"); };
  return <Tag onPointerMove={move} onPointerLeave={leave} className={cn("tilt", className)}>{children}</Tag>;
}
