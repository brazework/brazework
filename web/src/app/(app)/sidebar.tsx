"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Bookmark, CalendarDays, ChevronDown, FolderGit2, Home, LayoutDashboard, LogOut, MessageSquare, Network, PanelLeftClose, PanelLeftOpen, PenLine, Plus, Search, Settings, Sparkles, Trophy, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdatesButton } from "@/components/tour/tour-mount";
import { Avatar, Logo } from "@/components/ui";
import { MyStatus, WithPresence } from "@/components/presence/presence";
import { cn } from "@/lib/forge";
import { NavTile } from "@/components/app/nav-tile";
import { Ember } from "@/components/ember/ember";
import { foldMotion, useFold } from "@/components/app/rail-card";

export type Badges = { notifications: number; messages: number; invites: number };
type BadgeKey = keyof Badges;

// The five places in the signed-in app, built around one loop: join a club → post what you're
// building → your club verifies it → proof on your profile → companies find you. Everything else
// lives inside one of these (events in Clubs, notifications and saved on Home, analytics and
// settings on Profile). `match` = path prefixes that light the item up; `badge` = which count it shows.
const NAV: { href: string; label: string; icon: typeof Home; match: string[]; badge?: BadgeKey }[] = [
  { href: "/feed", label: "Home", icon: Home, match: ["/feed", "/post/", "/notifications", "/saved"], badge: "notifications" },
  { href: "/communities", label: "Clubs", icon: Users, match: ["/communities", "/c/", "/events", "/org"] },
  { href: "/projects", label: "Projects", icon: FolderGit2, match: ["/projects"] },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: ["/messages"], badge: "messages" },
  { href: "/profile", label: "Profile", icon: UserRound, match: ["/profile", "/u/", "/dashboard", "/analytics", "/network", "/settings"], badge: "invites" },
];

// Still a tap away, from the menu: the pages inside the five places.
const MORE: { href: string; label: string; icon: typeof Home; badge?: BadgeKey }[] = [
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/network", label: "Connections", icon: Network, badge: "invites" },
  { href: "/dashboard", label: "Analytics", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
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

export function Sidebar({ first, last, userId, badges, avatar, initialCollapsed = false, clubs = [] }: { first: string; last: string; userId: string; badges: Badges; avatar?: string | null; clubs?: { id: string; name: string }[]; initialCollapsed?: boolean }) {
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
      {/* The two things you do most: post what you're building, and ask Ember (⌘K from anywhere). */}
      <div className={cn("mt-6 flex gap-1.5", collapsed ? "flex-col items-center" : "px-1")}>
        <Link href="/feed#composer" onClick={(e) => { if (path === "/feed") { e.preventDefault(); window.dispatchEvent(new Event("forge:compose")); } }} title={collapsed ? "New post" : undefined} aria-label="New post"
          className={cn("bg-accent-grad inline-flex h-10 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-on-accent shadow-[0_8px_20px_-10px_rgb(0_0_0/0.5)] transition hover:opacity-90", collapsed ? "w-10" : "flex-1")}>
          <PenLine className="size-4" />{!collapsed && "New post"}
        </Link>
        {/* Ember, the orb: ask anything or jump anywhere (also ⌘K from any page). */}
        <button type="button" onClick={() => window.dispatchEvent(new Event("forge:palette"))} title="Ask Ember (⌘K)" aria-label="Ask Ember, or jump anywhere (Command K)"
          className="group grid size-10 shrink-0 place-items-center rounded-2xl border border-line bg-surface/60 transition hover:-translate-y-px hover:bg-hover">
          <span className="transition duration-300 group-hover:scale-110" style={{ "--ember-a": "#ffd166", "--ember-b": "#ff4d4d", "--ember-c": "#ff3d7f" } as React.CSSProperties}><Ember size={28} /></span>
        </button>
      </div>
      <nav data-tour="menu" aria-label="Main" className={cn("flex shrink-0 flex-col gap-0.5", collapsed ? "mt-4" : "mt-5")}>
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
      {/* Your clubs and More scroll on short screens, so the five main places are always whole. */}
      <div className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
      {/* Your clubs, one click away. */}
      {clubs.length > 0 && (
        <div aria-label="Your clubs" role="group" className={cn("mt-5 flex flex-col gap-0.5 border-t border-line pt-4", collapsed && "items-center")}>
          {!collapsed && <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">Your clubs</div>}
          {clubs.map((c) => {
            const active = path.startsWith(`/c/${c.id}`);
            return (
              <Link key={c.id} href={`/c/${c.id}`} title={collapsed ? c.name : undefined} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2.5 rounded-xl py-1.5 text-[13px] transition", collapsed ? "justify-center px-2" : "px-3", active ? "bg-hover font-medium text-text" : "text-text-2 hover:bg-hover hover:text-text")}>
                <span className="bg-accent-grad grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-on-accent">{c.name.slice(0, 1).toUpperCase()}</span>
                {!collapsed && <span className="truncate">{c.name}</span>}
              </Link>
            );
          })}
        </div>
      )}
      {/* Secondary places, in a quiet card under the five main ones. Folds to its header (remembered). */}
      <MoreGroup collapsed={collapsed} path={path} badges={badges} />
      </div>
      {/* You: your profile lives here (photo and name open it), with your online status and log out. */}
      <div className={cn("mt-2 flex shrink-0 items-center gap-3 rounded-2xl transition", onProfile ? "nav-pill" : "bg-surface/50 hover:bg-hover/60", collapsed ? "flex-col p-1.5" : "p-2.5")}>
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

// Phones: a slim top bar (logo, create, notifications, menu) plus a bottom tab bar with the same
// five places as the sidebar.
const TABS = NAV;

export function MobileBar({ first, last, badges, avatar }: { first: string; last: string; badges: Badges; avatar?: string | null }) {
  const path = usePathname();
  const [sheet, setSheet] = useState<"more" | "create" | null>(null);
  // Close the sheet when the page changes or Escape is pressed.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setSheet(null);
  }
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);
  const rest = MORE;
  const restCount = badges.invites;
  const tab = (t: (typeof TABS)[number]) => {
    const active = isActive(path, t.match);
    const count = t.badge ? badges[t.badge] : 0;
    return (
      <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} aria-label={count ? `${t.label}, ${count} new` : t.label} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10px] font-medium transition active:scale-90", active ? "text-text" : "text-faint")}>
        {active && <motion.span layoutId="tab-pill" className="absolute inset-0.5 rounded-[18px] bg-hover" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
        <span className="relative">
          <t.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
          <Count n={count} className="absolute -top-1.5 -right-2.5" />
        </span>
        <span className="relative">{t.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Top bar: under the notch / Dynamic Island, padded by the safe area. */}
      <header className="glass fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.625rem)] pb-2.5 md:hidden">
        <Link href="/feed" aria-label="Forge feed"><Logo /></Link>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setSheet("create")} aria-expanded={sheet === "create"} aria-label="Create" className="bg-accent-grad mr-1 grid size-9 place-items-center rounded-full text-on-accent shadow-[0_8px_18px_-8px_rgb(0_0_0/0.5)] transition active:scale-95">
            <Plus className="size-5" strokeWidth={2.4} />
          </button>
          <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-text-2 transition hover:bg-hover">
            <Search className="size-5" />
          </Link>
          <Link href="/notifications" aria-label={badges.notifications ? `Notifications, ${badges.notifications} new` : "Notifications"} className="relative grid size-10 place-items-center rounded-full text-text-2 transition hover:bg-hover">
            <Bell className="size-5" />
            <Count n={badges.notifications} className="absolute top-0.5 right-0" />
          </Link>
          <button type="button" onClick={() => setSheet("more")} aria-expanded={sheet === "more"} aria-label={restCount ? `Menu and your profile, ${restCount} new` : "Menu and your profile"} className="relative ml-1 rounded-full active:scale-90">
            <Avatar first={first} last={last} size={32} src={avatar} />
            <Count n={restCount} className="absolute -top-1 -right-1" />
          </button>
        </div>
      </header>

      {/* Floating tab bar above the home indicator: the five places. */}
      <nav aria-label="Main" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 md:hidden">
        <div className="glass grid grid-cols-5 items-center rounded-[26px] border border-line p-1 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)]">
          {TABS.map(tab)}
        </div>
      </nav>

      <Sheet open={sheet === "create"} title="Create" onClose={() => setSheet(null)}>
        <div className="grid grid-cols-2 gap-2">
          {CREATE.map((c) => (
            <Link key={c.label} href={c.href} onClick={(e) => { if (c.href === "/feed#composer" && path === "/feed") { e.preventDefault(); setSheet(null); window.dispatchEvent(new Event("forge:compose")); } }} className="flex flex-col gap-2 rounded-2xl border border-line p-4 text-left transition active:scale-[0.97]">
              <span className="nav-tile grid size-10 place-items-center rounded-xl text-text"><c.icon className="size-5" /></span>
              <span className="text-sm font-medium">{c.label}</span>
              <span className="text-xs leading-snug text-muted">{c.body}</span>
            </Link>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "more"} title="Menu" onClose={() => setSheet(null)}>
        <Link href="/profile" className="mb-3 flex items-center gap-3 rounded-2xl border border-line p-3 transition active:scale-[0.98]">
          <Avatar first={first} last={last} size={44} src={avatar} />
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{`${first} ${last}`.trim()}</span><span className="block text-xs text-muted">View your profile</span></span>
        </Link>
        <div className="grid grid-cols-3 gap-2">
          {rest.map((n) => {
            const count = n.badge ? badges[n.badge] : 0;
            return (
              <Link key={n.href} href={n.href} className="relative flex flex-col items-center gap-2 rounded-2xl border border-line py-4 text-xs text-text-2 transition active:scale-95">
                <n.icon className="size-5" />
                {n.label}
                <Count n={count} className="absolute top-2 right-2" />
              </Link>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl px-3 py-1 text-sm text-muted">Appearance <ThemeToggle /></div>
        <div className="mt-1"><UpdatesButton /></div>
        <form action="/auth/signout" method="post" className="mt-1">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted transition hover:bg-hover hover:text-text"><LogOut className="size-[18px]" /> Log out</button>
        </form>
      </Sheet>
    </>
  );
}

const CREATE = [
  { href: "/feed#composer", label: "Post", body: "An update, result or question", icon: PenLine },
  { href: "/copilot", label: "Ask Ember", body: "Your AI teammate does the busywork", icon: Sparkles },
  { href: "/profile#projects", label: "Add a project", body: "Show what you built", icon: FolderGit2 },
  { href: "/events", label: "Events", body: "Find one, or host for your club", icon: CalendarDays },
];

// A bottom sheet that slides up over the page, clear of the home indicator.
function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 90 || i.velocity.y > 500) onClose(); }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-base font-semibold">{title}</span>
              <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// "More": small tiles in a glass card, matching the main nav; the header folds it away.
function MoreGroup({ collapsed, path, badges }: { collapsed: boolean; path: string; badges: Badges }) {
  const [folded, setFolded] = useFold("sidebar-more");
  const waiting = MORE.reduce((n, m) => n + (m.badge ? badges[m.badge] ?? 0 : 0), 0);
  const items = MORE.map((n) => {
    const active = path.startsWith(n.href);
    const count = n.badge ? badges[n.badge] : 0;
    return (
      <Link key={n.href} href={n.href} data-tour={n.href === "/notifications" ? "bell" : undefined} aria-current={active ? "page" : undefined}
        aria-label={count ? `${n.label}, ${count} new` : collapsed ? n.label : undefined} title={collapsed ? n.label : undefined}
        className={cn("group relative flex items-center gap-2.5 rounded-xl py-1 text-[13px] transition", collapsed ? "justify-center px-0" : "px-1.5", active ? "font-medium text-text" : "text-text-2 hover:bg-hover/70 hover:text-text")}>
        {active && <motion.span layoutId="more-active" className="nav-pill absolute inset-0 rounded-xl" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
        <span className={cn("relative grid size-7 shrink-0 place-items-center rounded-lg transition duration-200 group-hover:-translate-y-px", active ? "nav-tile-on" : "nav-tile text-text-2 group-hover:text-text")}>
          <n.icon className="size-[15px]" />
        </span>
        {!collapsed && <span className="relative truncate">{n.label}</span>}
        <Count n={count} className={collapsed ? "absolute -top-0.5 right-0.5" : "relative ml-auto"} />
      </Link>
    );
  });
  if (collapsed) return <div aria-label="More" role="group" className="mt-4 flex flex-col items-center gap-1 border-t border-line pt-4">{items}</div>;
  return (
    <section aria-label="More" className="mt-5 rounded-2xl border border-line bg-surface/40 p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
      <button type="button" onClick={() => setFolded(!folded)} aria-expanded={!folded} className="group flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left">
        <span className="text-[11px] font-medium tracking-[0.12em] text-faint uppercase">More</span>
        {folded && waiting > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent tabular-nums">{waiting}</span>}
        <ChevronDown className={cn("ml-auto size-3.5 text-faint transition group-hover:text-text", !folded && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {!folded && <motion.div {...foldMotion} className="overflow-hidden"><div className="flex flex-col gap-0.5 pt-0.5">{items}</div></motion.div>}
      </AnimatePresence>
    </section>
  );
}
