"use client";
import { useEffect, useState } from "react";

// Phones: the landing page is a stack of full-screen pages. As each page lands, its content rises
// in (data-in), and a thin segmented bar under the nav shows where you are.
export function StoryRail() {
  const [count, setCount] = useState(0);
  const [at, setAt] = useState(0);
  useEffect(() => {
    // Every story section is a page, except Founding clubs, whose pitch and form are a page each.
    const pages = [...document.querySelectorAll<HTMLElement>("[data-story]")].flatMap((sec) => (sec.id === "founding" ? [...sec.querySelectorAll<HTMLElement>(":scope .grid.max-w-7xl > *")] : [sec]));
    document.documentElement.classList.add("js-story");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.in = "";
        setAt(pages.indexOf(e.target as HTMLElement));
      }
    }, { rootMargin: "-35% 0px -35% 0px" }); // a page counts once it crosses the middle of the screen
    pages.forEach((p) => io.observe(p));
    const t = setTimeout(() => setCount(pages.length), 0);
    return () => { io.disconnect(); clearTimeout(t); document.documentElement.classList.remove("js-story"); };
  }, []);
  if (count < 2) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-6 top-[calc(env(safe-area-inset-top)+4.6rem)] z-40 flex gap-1 md:hidden">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
          <span className={`block h-full rounded-full bg-text transition-transform duration-500 ease-out ${i <= at ? "translate-x-0" : "-translate-x-full"}`} />
        </span>
      ))}
    </div>
  );
}
