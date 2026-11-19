import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { Ember, type EmberMood } from "@/components/ember/ember";
import { TabRow } from "@/components/app/tab-row";

// Shared building blocks for signed-in pages, so every screen looks like one product.

// The top of every page (docs/design/app.md): the title, a one-line subtitle, optional `back` link
// above and `meta` line below (a status, a count), actions on the right.
export function PageHeader({ title, subtitle, actions, back, meta }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; meta?: React.ReactNode }) {
  return (
    <header className="pt-2 pb-1">
      {back && <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"><ArrowLeft className="size-4" /> {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-balance break-words text-text sm:text-[2rem]">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("glass-card rounded-xl p-5", className)}>{children}</section>;
}

// An empty list (docs/design/app.md): on the drawing-sheet grid, it says what goes here and offers the
// first action. Left-aligned, so it reads as a start, not a dead end. Ember waits beside it.
export function EmptyState({ icon, title, body, action, mood = "idle" }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; mood?: EmberMood }) {
  return (
    <div className="sheet-grid flex flex-col items-start gap-4 rounded-xl border border-dashed border-line-strong px-5 py-6 sm:flex-row sm:items-center sm:px-6">
      <div className="relative shrink-0">
        <Ember size={52} mood={mood} />
        {icon && <span className="absolute -right-1.5 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-surface-2 bg-text text-surface [&_svg]:size-3">{icon}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-text">{title}</div>
        {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Link-based tabs: the active tab lives in the URL (?tab=), so it survives refresh and sharing.
export function Tabs({ tabs, active }: { tabs: { id: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    // Redesign 2026-11: underline tabs (Linear/Vercel style): a hairline row, the current tab marked in ink.
    <TabRow active={active} className="no-scrollbar flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? "page" : undefined}
          className={cn(
            "relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors",
            t.id === active ? "border-text font-medium text-text" : "border-transparent text-muted hover:text-text",
          )}
        >
          {t.label}
          {t.count ? <span className="rounded bg-raised px-1.5 font-mono text-[10px] text-text-2">{t.count}</span> : null}
        </Link>
      ))}
    </TabRow>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} aria-hidden="true" />;
}

export const chipCls = "rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted";

// Clubs and their events are one place: this switch sits at the top of both pages.
export function ClubsSwitch({ active }: { active: "clubs" | "events" }) {
  const item = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm transition", on ? "bg-text font-medium text-bg" : "text-muted hover:text-text")}>{label}</Link>
  );
  return (
    <nav aria-label="Clubs and events" className="mb-5 inline-flex gap-1 rounded-full border border-line bg-surface p-1">
      {item("/communities", "Clubs", active === "clubs")}
      {item("/events", "Events", active === "events")}
    </nav>
  );
}
