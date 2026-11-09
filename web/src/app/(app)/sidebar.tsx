"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Bookmark, CalendarDays, Home, LayoutDashboard, LogOut, Menu, MessageSquare, Network, PanelLeftClose, PanelLeftOpen, Settings, Sparkles, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdatesButton } from "@/components/tour/tour-mount";
import { Avatar, Logo } from "@/components/ui";
import { MyStatus, WithPresence } from "@/components/presence/presence";
import { cn } from "@/lib/forge";
import { NavTile } from "@/components/app/nav-tile";

export type Badges = { notifications: number; messages: number; invites: number };
type BadgeKey = keyof Badges;

// Every screen of the signed-in app. `match` = path prefixes that light the item up; `badge` = which count it shows.
const NAV: { href: string; label: string; icon: typeof Home; match: string[]; badge?: BadgeKey }[] = [
  { href: "/feed", label: "Feed", icon: Home, match: ["/feed", "/post/"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/dashboard", "/analytics"] },
  { href: "/communities", label: "Communities", icon: Users, match: ["/communities", "/c/"] },
  { href: "/copilot", label: "Copilot", icon: Sparkles, match: ["/copilot"] },
  { href: "/network", label: "Network", icon: Network, match: ["/network"], badge: "invites" },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: ["/messages"], badge: "messages" },
  { href: "/events", label: "Events", icon: CalendarDays, match: ["/events", "/org"] },
  { href: "/notifications", label: "Notifications", icon: Bell, match: ["/notifications"], badge: "notifications" },
  { href: "/saved", label: "Saved", icon: Bookmark, match: ["/saved"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

const isActive = (path: string, match: string[]) => match.some((m) => path.startsWith(m));

function Count({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-grad px-1 font-mono text-[10px] leading-none text-on-accent tabular-nums", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 p-3 md:block" aria-busy="true">
      <div className="glass-panel flex h-full flex-col rounded-3xl p-3">
      <div className="px-2 pt-2"><Logo /></div>
      <div className="mt-10 flex flex-col gap-2">
        {NAV.map((n) => <div key={n.label} className="h-10 animate-pulse rounded-xl bg-surface/60" />)}
      </div>
      <div className="mt-auto h-16 animate-pulse rounded-2xl bg-surface/60" />
      </div>
    </aside>
  );
}

// Remembered in a cookie (not localStorage) so the server draws it at the right width: no jump on load.
export const SIDEBAR_COOKIE = "forge-sidebar";

export function Sidebar({ first, last, userId, badges, avatar, initialCollapsed = false }: { first: string; last: string; userId: string; badges: Badges; avatar?: string | null; initialCollapsed?: boolean }) {
  const path = usePathname();
  const onProfile = path.startsWith("/profile") || path === `/u/${userId}`;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <aside aria-label="Sidebar" className={cn("sticky top-0 isolate hidden h-dvh shrink-0 p-3 transition-[width] duration-300 ease-out motion-reduce:transition-none md:block", collapsed ? "w-[88px]" : "w-[264px]")}>
      {/* Soft light behind the glass, in Ember's colours, so the frosting has something to catch. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-3 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute -top-16 -left-20 size-56 rounded-full bg-[var(--ember-a)] opacity-30 blur-3xl" />
        <div className="absolute top-1/2 -right-28 size-48 rounded-full bg-[var(--ember-c)] opacity-20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-52 rounded-full bg-[var(--ember-b)] opacity-20 blur-3xl" />
      </div>
      <div className="glass-panel flex h-full flex-col rounded-3xl px-2 py-4">
      <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between pr-1 pl-2")}>
        <Link href="/feed" aria-label="Forge feed" className={cn(collapsed && "mb-2")}><Logo withWord={!collapsed} /></Link>
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <ThemeToggle />
          <button
            type="button"
            data-tour="sidebar-toggle"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-9 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text"
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>
        </div>
      </div>
      <nav data-tour="menu" aria-label="Main" className={cn("flex min-h-0 flex-col gap-0.5 overflow-y-auto", collapsed ? "mt-5" : "mt-8")}>
        {NAV.map((n) => {
          const active = isActive(path, n.match);
          const count = n.badge ? badges[n.badge] : 0;
          return (
            <Link
              key={n.label}
              href={n.href}
              data-tour={n.href === "/notifications" ? "bell" : undefined}
              aria-current={active ? "page" : undefined}
              aria-label={count ? `${n.label}, ${count} new` : collapsed ? n.label : undefined}
              title={collapsed ? n.label : undefined}
              className={cn("group relative flex items-center gap-3 rounded-2xl py-1.5 text-sm transition", collapsed ? "justify-center px-0" : "px-2", active ? "font-medium text-text" : "text-text-2 hover:bg-hover/60 hover:text-text")}
            >
              {active && <motion.span layoutId="nav-active" className="nav-pill absolute inset-0 rounded-2xl" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <NavTile icon={n.icon} active={active} ember={n.href === "/copilot"} />
              {!collapsed && <span className="relative">{n.label}</span>}
              <Count n={count} className={collapsed ? "absolute top-0 right-2.5" : "relative ml-auto"} />
            </Link>
          );
        })}
      </nav>
      {/* You: your profile lives here (photo and name open it), with your online status and log out. */}
      <div className={cn("mt-auto flex items-center gap-3 rounded-2xl transition", onProfile ? "nav-pill" : "bg-surface/50 hover:bg-hover/60", collapsed ? "flex-col p-1.5" : "p-2.5")}>
        <Link href="/profile" aria-label="Your profile" aria-current={onProfile ? "page" : undefined} title={collapsed ? `${first} ${last} · Profile` : undefined}><WithPresence id={userId} dot="size-2.5"><Avatar first={first} last={last} size={collapsed ? 32 : 36} src={avatar} /></WithPresence></Link>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <Link href="/profile" className="block truncate text-sm font-medium hover:underline">{first} {last}</Link>
            <MyStatus />
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button aria-label="Log out" className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-hover hover:text-text"><LogOut className="size-4" /></button>
        </form>
      </div>
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
