"use client";
import { motion } from "motion/react";
import { Bell, Bookmark, CalendarDays, Home, LogOut, MessageSquare, Network, Settings, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdatesButton } from "@/components/tour/tour-mount";
import { Avatar, Logo } from "@/components/ui";
import { cn } from "@/lib/forge";

// Every screen of the signed-in app. `match` = path prefixes that light the item up.
const NAV = [
  { href: "/feed", label: "Feed", icon: Home, match: ["/feed", "/post/"] },
  { href: "/communities", label: "Communities", icon: Users, match: ["/communities", "/c/"] },
  { href: "/network", label: "Network", icon: Network, match: ["/network"] },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: ["/messages"] },
  { href: "/events", label: "Events", icon: CalendarDays, match: ["/events", "/org"] },
  { href: "/notifications", label: "Notifications", icon: Bell, match: ["/notifications"] },
  { href: "/saved", label: "Saved", icon: Bookmark, match: ["/saved"] },
  { href: "/profile", label: "Profile", icon: UserRound, match: ["/profile", "/u/", "/analytics"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

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

export function Sidebar({ first, last, headline }: { first: string; last: string; headline: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col py-8 md:flex">
      <div className="flex items-center justify-between pr-1 pl-3">
        <Link href="/feed"><Logo /></Link>
        <ThemeToggle />
      </div>
      <nav data-tour="menu" className="mt-10 flex flex-col gap-1">
        {NAV.map((n) => {
          const active = n.match.some((m) => path.startsWith(m));
          return (
            <Link key={n.label} href={n.href} data-tour={n.href === "/notifications" ? "bell" : undefined} aria-current={active ? "page" : undefined} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "text-text" : "text-muted hover:bg-hover hover:text-text")}>
              {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-raised" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className="relative size-[18px]" />
              <span className="relative">{n.label}</span>
            </Link>
          );
        })}
        <UpdatesButton />
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
        <Avatar first={first} last={last} size={36} />
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

// Phones: the sidebar is hidden, so a slim top bar carries the logo, who you are and log out.
export function MobileBar({ first, last }: { first: string; last: string }) {
  return (
    <header className="glass -mx-4 flex items-center gap-3 px-4 py-3">
      <Link href="/feed" aria-label="Forge feed"><Logo /></Link>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Avatar first={first} last={last} size={30} />
        <form action="/auth/signout" method="post">
          <button aria-label="Log out" className="grid size-9 place-items-center rounded-lg text-faint transition hover:bg-hover hover:text-text"><LogOut className="size-4" /></button>
        </form>
      </div>
    </header>
  );
}
