"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/forge";

type Theme = "light" | "dark";

// The theme in effect: the saved choice (html[data-theme]), and light when there is none (every
// screen starts light; app/layout.tsx).
function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

export function useTheme() {
  return useSyncExternalStore(subscribe, current, () => "light" as Theme);
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("forge-theme", next);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={cn("grid size-9 place-items-center rounded-full text-muted transition hover:bg-hover hover:text-text", className)}
    >
      <Sun className="size-[18px] dark-only" />
      <Moon className="size-[18px] light-only" />
    </button>
  );
}
