"use client";
import { useEffect } from "react";

const SKIN_KEY = "forge-skin";
const SKINS = /^(blueprint|fire|aurora|emerald)$/;

// Keeps the phone's chrome (the strip behind the notch / Dynamic Island, and the theme-color Safari
// and the installed app tint with) the same color as the page. The landing page is always plain
// Brazework (no color theme); the app uses the member's chosen theme.
export function ThemeChrome({ landing = false }: { landing?: boolean }) {
  useEffect(() => {
    const d = document.documentElement;
    let saved: string | null = null;
    try { saved = localStorage.getItem(SKIN_KEY); } catch {}
    if (landing) delete d.dataset.skin;
    else if (saved && SKINS.test(saved) && d.dataset.skin !== saved) d.dataset.skin = saved;

    const paint = () => {
      const bg = getComputedStyle(d).getPropertyValue("--bg").trim() || getComputedStyle(document.body).backgroundColor;
      let metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
      if (!metas.length) { const m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); metas = [m]; }
      // One value for every media variant, so the tint follows Brazework's theme, not just the OS setting.
      metas.forEach((m) => { m.content = bg; });
    };
    paint();
    const mo = new MutationObserver(paint);
    mo.observe(d, { attributes: true, attributeFilter: ["data-theme", "data-skin", "class"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", paint);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", paint);
      if (landing && saved && SKINS.test(saved)) d.dataset.skin = saved;
    };
  }, [landing]);

  // The strip behind the notch: solid page color, above everything, never catches taps.
  return <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[env(safe-area-inset-top)] bg-bg" />;
}
