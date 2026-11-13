"use client";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Bell, Bookmark, CalendarDays, FolderGit2, Hammer, Inbox, LayoutDashboard, LogOut, Network, PanelLeftClose, PanelLeftOpen, PenLine, Plus, Search, Settings, Sparkles, Sun, Trophy, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdatesButton, UpdatesDialog } from "@/components/tour/tour-mount";
import { Avatar, Logo, menuCls, menuItemCls } from "@/components/ui";
import { MyStatus, WithPresence } from "@/components/presence/presence";
import { cn } from "@/lib/forge";
import { MENU_PAGES, PLACES, placeFor, type BadgeKey, type PlaceId } from "@/lib/places";
import { NavTile, TILE } from "@/components/app/nav-tile";

export type Badges = Record<BadgeKey, number>;

// The five places of the signed-in app (redesign stage 1), each answering one question: Today (what
// needs me?), Build (what am I making?), Club (what's my team doing?), Proof (what have I proven?),
// Inbox (who's reaching out?). The list itself, and which place a page belongs to, live in
// lib/places.ts; here they only get their icons. There is no More drawer: every other page sits inside
// one of the five, a tab away (components/app/place-tabs.tsx), and settings are on your avatar.
const PLACE_ICON: Record<PlaceId, typeof Sun> = { today: Sun, build: Hammer, club: Users, proof: BadgeCheck, inbox: Inbox };
const NAV = PLACES.map((p) => ({ ...p, icon: PLACE_ICON[p.id] }));

// Phones keep one sheet with every page inside the places (lib/places.ts MENU_PAGES).
const MENU_ICON: Record<string, typeof Sun> = { "/notifications": Bell, "/events": CalendarDays, "/challenges": Trophy, "/pro": BadgeCheck, "/saved": Bookmark, "/network": Network, "/dashboard": LayoutDashboard, "/settings": Settings };

// One row, one tile, one group card for every part of the sidebar, so the icons line up and match.
const ROW = "group relative flex items-center gap-2.5 rounded-md py-1 text-sm transition";
// Sections are separated by a hairline and a small label, not boxed in cards.
const GROUP = "border-t border-line/70 pt-3";
const GROUP_LABEL = "px-2 py-1.5 text-[11px] font-medium tracking-[0.12em] text-faint uppercase";
const TOP_BTN = cn(TILE, "text-faint hover:bg-hover hover:text-text");

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
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 md:block" aria-busy="true">
      <div className="flex h-full flex-col border-r border-line bg-surface-2/70 p-3">
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

export function Sidebar({ first, last, userId, badges, avatar, initialCollapsed = false, clubs = [] }: { first: string; last: string; userId: string; badges: Badges; avatar?: string | null; clubs?: { id: string; name: string; image?: string | null }[]; initialCollapsed?: boolean }) {
  const path = usePathname();
  const here = placeFor(path)?.id;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <motion.aside layoutRoot aria-label="Sidebar" className={cn("sticky top-0 isolate z-30 hidden h-dvh shrink-0 transition-[width] duration-300 ease-out motion-reduce:transition-none md:block", collapsed ? "w-16" : "w-[248px]")}>
      {/* A flush, calm column (redesign 2026-11): a hairline edge on a soft tint, no floating glass. */}
      <div className="flex h-full flex-col border-r border-line bg-surface-2/70 px-2 py-3">
      <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between pr-1 pl-2")}>
        <Link href="/feed" aria-label="Brazework feed" className={cn(collapsed && "mb-2")}><Logo withWord={!collapsed} /></Link>
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <button
            type="button"
            data-tour="sidebar-toggle"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={TOP_BTN}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
      </div>
      {/* The one action that starts the loop: log what you built. (Ember is the bar above every page, and ⌘K.) */}
      <div className={cn("mt-6 flex", collapsed ? "justify-center" : "px-1")}>
        <Link href="/feed#composer" onClick={(e) => { if (path === "/feed") { e.preventDefault(); window.dispatchEvent(new Event("forge:compose")); } }} title={collapsed ? "Log work" : undefined} aria-label="Log work"
          className={cn("bg-accent-grad inline-flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium text-on-accent transition hover:opacity-90", collapsed ? "w-9" : "flex-1")}>
          <PenLine className="size-4" />{!collapsed && "Log work"}
        </Link>
      </div>
      <nav data-tour="menu" aria-label="Main" className={cn("flex shrink-0 flex-col gap-0.5", collapsed ? "mt-4" : "mt-5")}>
        {NAV.map((n) => {
          const active = here === n.id;
          const count = n.badge ? badges[n.badge] : 0;
          return (
            <Link
              key={n.label}
              href={n.href}
              aria-current={active ? "page" : undefined}
              aria-label={count ? `${n.label}, ${count} new` : collapsed ? n.label : undefined}
              title={collapsed ? n.label : undefined}
              className={cn(ROW, collapsed ? "justify-center px-0" : "px-2", active ? "font-medium text-text" : "text-text-2 hover:bg-hover/60 hover:text-text")}
            >
              {active && <motion.span layoutId="nav-active" className="nav-pill absolute inset-0 rounded-md" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <NavTile icon={n.icon} active={active} />
              {!collapsed && <span className="relative">{n.label}</span>}
              <Count n={count} className={collapsed ? "absolute top-0 right-2.5" : "relative ml-auto"} />
            </Link>
          );
        })}
      </nav>
      {/* Your clubs scroll on short screens, so the five places are always whole. */}
      <div className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
      {/* Your clubs, one click away. */}
      {clubs.length > 0 && (
        <div aria-label="Your clubs" role="group" className={cn("mt-5 flex flex-col gap-0.5", collapsed ? "items-center border-t border-line pt-4" : GROUP)}>
          {!collapsed && <div className={GROUP_LABEL}>Your clubs</div>}
          {clubs.map((c) => {
            const active = path.startsWith(`/c/${c.id}`);
            return (
              <Link key={c.id} href={`/c/${c.id}`} title={collapsed ? c.name : undefined} aria-current={active ? "page" : undefined}
                className={cn(ROW, collapsed ? "justify-center px-0" : "px-1.5", active ? "font-medium text-text" : "text-text-2 hover:bg-hover/70 hover:text-text")}>
                {active && <motion.span layoutId="club-active" className="nav-pill absolute inset-0 rounded-md" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <NavTile letter={c.name} image={c.image} active={active} />
                {!collapsed && <span className="relative truncate">{c.name}</span>}
              </Link>
            );
          })}
        </div>
      )}
      </div>
      <YouMenu first={first} last={last} userId={userId} avatar={avatar} collapsed={collapsed} path={path} />
      </div>
    </motion.aside>
  );
}

// You, at the foot of the sidebar: one button (photo, name, online status) that opens a small menu
// with your profile, settings, appearance, what's new and log out. They used to be spread over the
// sidebar's top row, the More drawer and a lone log-out icon.
function YouMenu({ first, last, userId, avatar, collapsed, path }: { first: string; last: string; userId: string; avatar?: string | null; collapsed: boolean; path: string }) {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Closes when the page changes, on Escape, and on a click anywhere else.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [open]);
  return (
    <div ref={box} className="relative mt-2 shrink-0">
      {/* The updates dialog lives outside the menu, so it stays open after the menu closes. */}
      <UpdatesDialog open={updates} onClose={() => setUpdates(false)} />
      <div data-tour="updates" className={cn("flex items-center gap-2.5 rounded-lg transition hover:bg-hover/60", open && "bg-hover/60", collapsed ? "justify-center p-1.5" : "p-2")}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="you-menu" aria-label={`${first} ${last}: profile, settings and log out`} title={collapsed ? `${first} ${last}` : undefined} className="shrink-0 rounded-full">
          <WithPresence id={userId} dot="size-2.5"><Avatar first={first} last={last} size={collapsed ? 28 : 32} src={avatar} /></WithPresence>
        </button>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => setOpen(!open)} tabIndex={-1} aria-hidden="true" className="block w-full truncate text-left text-sm font-medium">{first} {last}</button>
            <MyStatus />
          </div>
        )}
      </div>
      {/* After the button in the page, so Tab moves from it straight into the list. */}
      <AnimatePresence>
        {open && (
          <motion.div id="you-menu" aria-label="You" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
            className={cn(menuCls, "absolute bottom-[calc(100%+6px)] left-0 z-50 w-56")}>
            <Link href="/profile" onClick={() => setOpen(false)} className={menuItemCls}><UserRound className="size-4" /> View profile</Link>
            <Link href="/settings" onClick={() => setOpen(false)} className={menuItemCls}><Settings className="size-4" /> Settings</Link>
            <div className="flex items-center justify-between px-2.5 py-1 text-sm text-text-2">Appearance <ThemeToggle className={TOP_BTN} /></div>
            <button type="button" onClick={() => { setOpen(false); setUpdates(true); }} className={menuItemCls}><Sparkles className="size-4" /> What&apos;s new</button>
            <form action="/auth/signout" method="post" className="mt-1 border-t border-line pt-1">
              <button className={menuItemCls}><LogOut className="size-4" /> Log out</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const rest = MENU_PAGES.map((m) => ({ ...m, icon: MENU_ICON[m.href] ?? Settings }));
  const restCount = badges.invites;
  const here = placeFor(path)?.id;
  const tab = (t: (typeof TABS)[number]) => {
    const active = here === t.id;
    const count = t.badge ? badges[t.badge] : 0;
    return (
      <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} aria-label={count ? `${t.label}, ${count} new` : t.label} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition active:scale-90", active ? "text-text" : "text-faint")}>
        {active && <motion.span layoutId="tab-pill" className="absolute inset-0.5 rounded-xl bg-hover" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
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
        <Link href="/feed" aria-label="Brazework feed"><Logo /></Link>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setSheet("create")} aria-expanded={sheet === "create"} aria-label="Create" className="bg-accent-grad mr-1 grid size-9 place-items-center rounded-full text-on-accent transition active:scale-95">
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
      <motion.nav layoutRoot aria-label="Main" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 md:hidden">
        <div className="glass grid grid-cols-5 items-center rounded-2xl border border-line p-1 shadow-[var(--shadow-float)]">
          {TABS.map(tab)}
        </div>
      </motion.nav>

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
  { href: "/feed#composer", label: "Log work", body: "An update, result or question", icon: PenLine },
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
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
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
