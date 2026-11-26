"use client";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Logo } from "@/components/ui";
import { cn } from "@/lib/forge";

// `wide`: only in the bar on a wide screen. `noPhone`: a section a phone doesn't show (app/page.tsx), so
// the phone menu leaves it out. Section links (#how) point back at the landing page from /schools.
const LINKS: { href: string; label: string; wide?: boolean; noPhone?: boolean }[] = [
  { href: "#how", label: "How it works" },
  { href: "/schools", label: "For schools" },
  { href: "/pricing", label: "Pricing" },
  { href: "/ai", label: "Connect your AI", wide: true },
];

export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const to = (href: string) => (href.startsWith("#") && path !== "/" ? `/${href}` : href);
  const current = (href: string) => here === href || path === href;
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  // Where you are on the page: the last linked section whose top has passed a third of the way down
  // the screen. The sections between two links (who signs, why, the 3D build) count as the one above.
  const [here, setHere] = useState("");
  useEffect(() => {
    const marks = LINKS.filter((l) => l.href.startsWith("#")).map((l) => document.getElementById(l.href.slice(1))).filter((el): el is HTMLElement => !!el);
    let frame = 0;
    const read = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      const past = marks.filter((el) => el.getBoundingClientRect().top <= line);
      setHere(past.length ? `#${past[past.length - 1].id}` : "");
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <nav
        aria-label="Main"
        className={cn(
          "relative flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-0 rounded-2xl sm:gap-x-6 px-4 py-2.5 transition-all duration-500",
          scrolled || open ? "glass shadow-[var(--shadow-float)]" : "theme-dark border border-transparent bg-transparent",
        )}
      >
        {/* How far down the page you've read: a hairline along the bar's lower edge, once it floats. */}
        <motion.span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-4 bottom-0 h-px origin-left bg-text transition-opacity duration-300", scrolled && !open ? "opacity-60" : "opacity-0")} style={{ scaleX: scrollYProgress }} />
        <Link href="/" aria-label="Brazework home"><Logo /></Link>
        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href} className={cn(l.wide && "hidden xl:block")}>
              <a href={to(l.href)} aria-current={here === l.href ? "location" : path === l.href ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm transition hover:bg-hover hover:text-text", current(l.href) ? "bg-hover text-text" : "text-muted")}>{l.label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden sm:contents"><ThemeToggle /></span>
          <Button href="/login" variant="ghost" className="hidden sm:inline-flex">Log in</Button>
          <Button href="/signup">Get started</Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-10 place-items-center rounded-lg text-muted transition hover:bg-hover hover:text-text md:hidden"
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
              {[...LINKS.filter((l) => !l.noPhone), { href: "/login", label: "Log in" }].map((l) => (
                <li key={l.href}>
                  <a href={to(l.href)} onClick={() => setOpen(false)} className="block rounded-xl px-2 py-3 text-[15px] text-text-2 transition hover:bg-hover hover:text-text">
                    {l.label}
                  </a>
                </li>
              ))}

              <li className="flex items-center justify-between px-2 py-2 text-[15px] text-text-2">Theme <ThemeToggle /></li>
            </motion.ul>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
