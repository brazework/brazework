"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// A story told by scrolling, made for a phone first (2026-11-27): a screen stays put while the steps
// scroll past it, and the step in the middle of the screen decides what the screen shows. On an iPhone
// the screen sticks under the nav and each step's words scroll up beneath it; on a laptop the screen
// sits in a phone on the right and the steps scroll on the left, with the braze seam beside them
// (globals.css .seam-v). Nothing plays by itself, so it reads the same with reduced motion (the
// screens just swap without moving). Used by the Torch section and the /for/* pages.

export type StoryStep = { title: string; body: React.ReactNode; screen: React.ReactNode };

export function StickyStory({ steps, label }: { steps: StoryStep[]; label: string }) {
  const [at, setAt] = useState(0);
  const marks = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setAt(Number((e.target as HTMLElement).dataset.k)); }
    }, { rootMargin: "-48% 0px -48% 0px" });
    marks.current.forEach((m) => m && io.observe(m));
    return () => io.disconnect();
  }, [steps.length]);

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" style={{ "--seam": (at + 1) / steps.length } as React.CSSProperties}>
      {/* The screen: sticky under the nav on a phone, in a phone on a laptop. */}
      <div className="story-stage sticky self-start top-[calc(env(safe-area-inset-top)+4.75rem)] z-10 -mx-5 bg-bg px-5 pb-4 sm:-mx-6 sm:px-6 lg:order-2 lg:top-0 lg:mx-0 lg:flex lg:h-svh lg:items-center lg:justify-center lg:bg-transparent lg:px-0 lg:pb-0">
        <figure aria-label={label} className="story-device relative mx-auto h-[min(23rem,46svh)] w-full max-w-[26rem] overflow-hidden rounded-[1.75rem] border border-line bg-surface lg:h-[36rem] lg:w-[18.5rem] lg:max-w-none lg:rounded-[2.75rem]">
          <span aria-hidden="true" className="absolute top-2.5 left-1/2 z-20 hidden h-[1.375rem] w-[5.5rem] -translate-x-1/2 rounded-full bg-black lg:block" />
          {steps.map((s, k) => (
            <div key={s.title} aria-hidden={k !== at} inert={k !== at}
              className={cn("absolute inset-0 transition duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", k === at ? "translate-y-0 scale-100 opacity-100" : k < at ? "-translate-y-3 scale-[0.98] opacity-0" : "translate-y-3 scale-[0.98] opacity-0")}>
              {s.screen}
            </div>
          ))}
        </figure>
        {/* Where you are, on a phone: a dot per step. */}
        <div aria-hidden="true" className="mt-3 flex justify-center gap-1.5 lg:hidden">
          {steps.map((s, k) => <span key={s.title} className={cn("h-1 rounded-full transition-all duration-500", k === at ? "w-6 bg-brand" : "w-1.5 bg-line-strong")} />)}
        </div>
      </div>

      <ol className="relative lg:order-1">
        <span aria-hidden="true" className="seam-v absolute top-0 bottom-0 left-0 hidden lg:block"><span className="seam-fill" /><span className="seam-head" /></span>
        {steps.map((s, k) => (
          <li key={s.title} ref={(el) => { marks.current[k] = el; }} data-k={k} className="flex min-h-[58svh] items-center py-8 lg:min-h-[78svh] lg:pl-10">
            <div className={cn("max-w-[30rem] transition-opacity duration-500 motion-reduce:transition-none", k === at ? "opacity-100" : "opacity-40")}>
              <p className="text-[13px] font-medium text-brand">Step {k + 1} of {steps.length}</p>
              <h3 className="mt-2 text-[1.625rem] leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-3xl">{s.title}</h3>
              <div className="mt-3 text-[16px] leading-relaxed text-muted sm:text-[17px]">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
