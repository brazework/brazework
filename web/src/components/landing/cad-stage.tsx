"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import type { BuildId } from "./cad/models";
import type { Lab, Mode } from "./cad/engine";

// The 3D stage behind the landing page's hero (redesign 2026-11): a build drawn the way its maker sees
// it in CAD, with callouts that follow their parts. three.js (cad/engine.ts) loads once the page is
// idle, so the headline paints first; where WebGL can't start, the stage says so and the rest of the
// hero works the same. `data-state` (waiting, ready, failed) is what the tests read.
export type { BuildId, Mode };

export function CadStage({ build, mode, callouts, className, children }: { build: BuildId; mode: Mode; callouts: Record<string, string>; className?: string; children?: React.ReactNode }) {
  const [state, setState] = useState<"waiting" | "ready" | "failed">("waiting");
  const host = useRef<HTMLDivElement>(null);
  const lab = useRef<Lab | null>(null);
  const tags = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = async () => {
      try {
        const { createLab } = await import("./cad/engine");
        if (gone) return;
        lab.current = createLab(el, {
          build, mode, still, dark: true,
          place: (id, x, y, show, right) => {
            const c = tags.current[id];
            if (!c) return;
            c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            c.style.opacity = show ? "1" : "0";
            // Labels lead away from the middle, unless that side has no room (a phone).
            const room = 190, width = el.clientWidth;
            const side = x < room ? "r" : x > width - room ? "l" : right ? "r" : "l";
            if (c.dataset.side !== side) c.dataset.side = side;
          },
        });
        setState("ready");
      } catch {
        if (!gone) setState("failed");
      }
    };
    // After first paint and the page's own work, not before.
    const idle = "requestIdleCallback" in window;
    const id = idle ? window.requestIdleCallback(() => void start(), { timeout: 1200 }) : window.setTimeout(() => void start(), 300);
    return () => {
      gone = true;
      if (idle) window.cancelIdleCallback(id); else window.clearTimeout(id);
      lab.current?.dispose();
      lab.current = null;
    };
    // The stage starts once with the current build and mode; changes go through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { lab.current?.setBuild(build); }, [build]);
  useEffect(() => { lab.current?.setMode(mode); }, [mode]);

  return (
    <div id="cad-stage" data-state={state} className={cn("cad-sheet relative overflow-hidden", className)}>
      <div ref={host} aria-hidden="true" className={cn("absolute inset-0 transition-opacity duration-700", state === "ready" ? "opacity-100" : "opacity-0")} />
      {state === "waiting" && <div aria-hidden="true" className="absolute inset-0 grid place-items-center"><div className="cad-scan h-px w-2/3" /></div>}
      {state === "failed" && <p className="absolute inset-x-0 top-1/3 px-6 text-center text-sm text-muted">This browser can&apos;t draw 3D right now. Everything else here still works.</p>}
      {state === "ready" && Object.entries(callouts).map(([id, text]) => (
        <div key={`${build}-${id}`} ref={(n) => { tags.current[id] = n; }} data-side="r" className="cad-callout pointer-events-none absolute top-0 left-0 opacity-0 transition-opacity duration-300" aria-hidden="true">
          <span className="block size-2 -translate-x-1 -translate-y-1 rounded-full border-2 border-brand bg-surface" />
          <span className="cad-leader absolute top-[-1px] h-px w-9 bg-brand/70" />
          <span className="cad-tag absolute top-[-24px] rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-[11px] whitespace-nowrap text-text shadow-[var(--shadow)] backdrop-blur-sm">{text}</span>
        </div>
      ))}
      {children}
    </div>
  );
}
