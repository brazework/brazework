import type { CSSProperties } from "react";
import { cn } from "@/lib/forge";

// Fades and lifts children in as they scroll into view, using a CSS scroll-driven animation
// (.reveal in globals.css). No JavaScript, so content is never hidden waiting for hydration.
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("reveal", className)} style={{ "--rd": Math.round(delay * 100) } as CSSProperties}>
      {children}
    </div>
  );
}
