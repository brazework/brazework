"use client";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Logo } from "@/components/ui";
import { cn } from "@/lib/forge";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#disciplines", label: "Disciplines" },
  { href: "#why", label: "Why Forge" },
  { href: "#organizations", label: "For organizations" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="rise-in fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Main"
        className={cn(
          "relative flex w-full max-w-6xl flex-wrap items-center gap-6 rounded-[26px] px-4 py-2.5 transition-all duration-500",
          scrolled || open ? "glass shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]" : "border border-transparent",
        )}
      >
        <Link href="/" aria-label="Forge home"><Logo /></Link>
        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-hover hover:text-text">{l.label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1">
          <Button href="/login" variant="ghost" className="hidden sm:inline-flex">Log in</Button>
          <Button href="/signup">Get started</Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="ml-1 grid size-10 place-items-center rounded-full text-muted transition hover:bg-hover hover:text-text md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.ul
              id="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full overflow-hidden md:hidden"
            >
              {[...LINKS, { href: "/login", label: "Log in" }].map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-2 py-3 text-[15px] text-text-2 transition hover:bg-hover hover:text-text">
                    {l.label}
                  </a>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
