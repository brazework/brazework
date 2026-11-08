"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Bookmark, CalendarDays, Home, LogOut, Menu, MessageSquare, Network, Settings, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdatesButton } from "@/components/tour/tour-mount";
import { Avatar, Logo } from "@/components/ui";
import { cn } from "@/lib/forge";

export type Badges = { notifications: number; messages: number; invites: number };
type BadgeKey = keyof Badges;

// Every screen of the signed-in app. `match` = path prefixes that light the item up; `badge` = which count it shows.
const NAV: { href: string; label: string; icon: typeof Home; match: string[]; badge?: BadgeKey }[] = [
  { href: "/feed", label: "Feed", icon: Home, match: ["/feed", "/post/"] },
  { href: "/communities", label: "Communities", icon: Users, match: ["/communities", "/c/"] },
  { href: "/network", label: "Network", icon: Network, match: ["/network"], badge: "invites" },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: ["/messages"], badge: "messages" },
  { href: "/events", label: "Events", icon: CalendarDays, match: ["/events", "/org"] },
  { href: "/notifications", label: "Notifications", icon: Bell, match: ["/notifications"], badge: "notifications" },
  { href: "/saved", label: "Saved", icon: Bookmark, match: ["/saved"] },
  { href: "/profile", label: "Profile", icon: UserRound, match: ["/profile", "/u/", "/analytics"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

const isActive = (path: string, match: string[]) => match.some((m) => path.startsWith(m));

function Count({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[10px] leading-none text-on-accent tabular-nums", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col py-8 md:flex" aria-busy="true">
      <div className="px-3"><Logo /></div>
      <div className="mt-10 flex flex-col gap-2">
        {NAV.map((n) => <div key={n.label} className="h-10 animate-pulse rounded-xl bg-surface/60" />)}
      </div>
      <div className="mt-auto h-16 animate-pulse rounded-2xl bg-surface/60" />
    </aside>
  );
}

export function Sidebar({ first, last, headline, badges, avatar }: { first: string; last: string; headline: string; badges: Badges; avatar?: string | null }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col py-8 md:flex">
      <div className="flex items-center justify-between pr-1 pl-3">
        <Link href="/feed"><Logo /></Link>
        <ThemeToggle />
      </div>
      <nav data-tour="menu" aria-label="Main" className="mt-10 flex flex-col gap-1">
        {NAV.map((n) => {
          const active = isActive(path, n.match);
          const count = n.badge ? badges[n.badge] : 0;
          return (
            <Link
              key={n.label}
              href={n.href}
              data-tour={n.href === "/notifications" ? "bell" : undefined}
              aria-current={active ? "page" : undefined}
              aria-label={count ? `${n.label}, ${count} new` : undefined}
              className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "text-text" : "text-muted hover:bg-hover hover:text-text")}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-raised" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className="relative size-[18px]" />
              <span className="relative">{n.label}</span>
              <Count n={count} className="relative ml-auto" />
            </Link>
          );
        })}
        <UpdatesButton />
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
        <Link href="/profile" aria-label="Your profile"><Avatar first={first} last={last} size={36} src={avatar} /></Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{first} {last}</div>
          <div className="truncate text-xs text-faint">{headline}</div>
        </div>
        <form action="/auth/signout" method="post">
          <button aria-label="Log out" className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-hover hover:text-text"><LogOut className="size-4" /></button>
        </form>
      </div>
    </aside>
  );
}

// Phones: a slim top bar (logo, theme, you) plus a bottom tab bar with the four places people go
// most and a "More" sheet for everything else.
const TABS: { href: string; label: string; icon: typeof Home; match: string[]; badge?: BadgeKey }[] = [
  { href: "/feed", label: "Feed", icon: Home, match: ["/feed", "/post/"] },
  { href: "/communities", label: "Clubs", icon: Users, match: ["/communities", "/c/"] },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: ["/messages"], badge: "messages" },
  { href: "/notifications", label: "Alerts", icon: Bell, match: ["/notifications"], badge: "notifications" },
];

export function MobileBar({ first, last, badges, avatar }: { first: string; last: string; badges: Badges; avatar?: string | null }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  // Close the sheet when the page changes or Escape is pressed.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setMore(false);
  }
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);
  const rest = NAV.filter((n) => !TABS.some((t) => t.href === n.href));
  const restCount = rest.reduce((sum, n) => sum + (n.badge ? badges[n.badge] : 0), 0);

  return (
    <>
      <header className="glass fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-4 py-3 md:hidden">
        <Link href="/feed" aria-label="Forge feed"><Logo /></Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link href="/profile" aria-label="Your profile" className="ml-1"><Avatar first={first} last={last} size={30} src={avatar} /></Link>
        </div>
      </header>

      <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((t) => {
          const active = isActive(path, t.match);
          const count = t.badge ? badges[t.badge] : 0;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} aria-label={count ? `${t.label}, ${count} new` : t.label} className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition", active ? "text-text" : "text-faint")}>
              <span className="relative">
                <t.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                <Count n={count} className="absolute -top-1.5 -right-2.5" />
              </span>
              {t.label}
            </Link>
          );
        })}
        <button onClick={() => setMore(true)} aria-expanded={more} aria-label={restCount ? `More, ${restCount} new` : "More"} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-faint">
          <span className="relative"><Menu className="size-[22px]" strokeWidth={1.8} /><Count n={restCount} className="absolute -top-1.5 -right-2.5" /></span>
          More
        </button>
      </nav>

      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-sm font-medium">More</span>
                <button onClick={() => setMore(false)} aria-label="Close" className="grid size-9 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rest.map((n) => {
                  const count = n.badge ? badges[n.badge] : 0;
                  return (
                    <Link key={n.href} href={n.href} className="relative flex flex-col items-center gap-2 rounded-2xl border border-line py-4 text-xs text-text-2 transition hover:bg-hover">
                      <n.icon className="size-5" />
                      {n.label}
                      <Count n={count} className="absolute top-2 right-2" />
                    </Link>
                  );
                })}
              </div>
              <div className="mt-2"><UpdatesButton /></div>
              <form action="/auth/signout" method="post" className="mt-1">
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-hover hover:text-text"><LogOut className="size-[18px]" /> Log out</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
