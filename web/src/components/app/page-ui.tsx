import Link from "next/link";
import { cn } from "@/lib/forge";
import { Ember, type EmberMood } from "@/components/ember/ember";

// Shared building blocks for signed-in pages, so every screen looks like one product.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    // Redesign 2026-11: a title on the page, not a card. Notion-style: big, calm, left-aligned.
    <header className="flex flex-wrap items-end justify-between gap-4 pt-2 pb-1">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-text sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("glass-card rounded-xl p-5", className)}>{children}</section>;
}

export function EmptyState({ icon, title, body, action, mood = "idle" }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; mood?: EmberMood }) {
  return (
    <div className="relative flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      <div className="relative mb-3">
        <Ember size={68} mood={mood} />
        {icon && <span className="absolute -right-2 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-bg bg-accent-grad text-on-accent [&_svg]:size-3.5">{icon}</span>}
      </div>
      <div className="relative font-semibold">{title}</div>
      {body && <p className="relative mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

// Link-based tabs: the active tab lives in the URL (?tab=), so it survives refresh and sharing.
export function Tabs({ tabs, active }: { tabs: { id: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    // Redesign 2026-11: underline tabs (Linear/Vercel style): a hairline row, the current tab marked in ink.
    <nav className="no-scrollbar flex gap-5 overflow-x-auto border-b border-line">
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
    </nav>
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
