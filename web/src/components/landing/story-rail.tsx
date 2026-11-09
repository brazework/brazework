"use client";
import { useEffect, useState } from "react";

// Phones: the landing page reads as a set of screens. A thin rail on the right shows where you
// are (tap a mark to jump), and the section's name shows for a moment as each one arrives.
export function StoryRail() {
  const [secs, setSecs] = useState<{ id: string; title: string }[]>([]);
  const [at, setAt] = useState(0);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-story]")];
    const list = els.map((e) => ({ id: e.id, title: e.dataset.story ?? "" }));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setAt(els.indexOf(e.target as HTMLElement)); setFlash(true); }
    }, { rootMargin: "-45% 0px -45% 0px" });
    els.forEach((e) => io.observe(e));
    const t = setTimeout(() => setSecs(list), 0);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1400);
    return () => clearTimeout(t);
  }, [flash, at]);
  if (secs.length < 2) return null;
  return (
    <div className="md:hidden" aria-hidden="true">
      <div className="fixed top-1/2 right-1.5 z-40 flex -translate-y-1/2 flex-col gap-1.5">
        {secs.map((s, i) => (
          <button key={s.id} type="button" tabIndex={-1} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })} className="grid h-5 w-4 place-items-center">
            <span className={`block w-1 rounded-full transition-all duration-300 ${i === at ? "h-5 bg-text" : "h-1.5 bg-line-strong"}`} />
          </button>
        ))}
      </div>
      <div className={`glass pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-40 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition duration-300 ${flash && at > 0 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
        <span className="text-faint tabular-nums">{at + 1}/{secs.length}</span> · {secs[at]?.title}
      </div>
    </div>
  );
}
