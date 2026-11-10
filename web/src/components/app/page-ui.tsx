import Link from "next/link";
import { cn } from "@/lib/forge";
import { Ember, type EmberMood } from "@/components/ember/ember";

// Shared building blocks for signed-in pages, so every screen looks like one product.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-3xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow)] sm:px-6 sm:py-5">
      <div className="bg-accent-grad pointer-events-none absolute -top-24 -right-16 size-64 rounded-full banner-glow blur-3xl" aria-hidden="true" />
      <div className="relative min-w-0">
        <h1 className="text-grad text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="relative flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("glass-card rounded-3xl p-5", className)}>{children}</section>;
}

export function EmptyState({ icon, title, body, action, mood = "idle" }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; mood?: EmberMood }) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <div className="bg-accent-grad pointer-events-none absolute top-6 left-1/2 size-40 -translate-x-1/2 rounded-full banner-glow blur-3xl" aria-hidden="true" />
      <div className="relative mb-3">
        <Ember size={68} mood={mood} />
        {icon && <span className="absolute -right-2 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-surface bg-accent-grad text-on-accent shadow-md [&_svg]:size-3.5">{icon}</span>}
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
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition active:scale-95",
            t.id === active ? "bg-accent-grad text-on-accent shadow-[0_6px_18px_-8px_var(--accent)]" : "text-muted hover:bg-hover hover:text-text",
          )}
        >
          {t.label}
          {t.count ? <span className={cn("rounded-full px-1.5 font-mono text-[10px]", t.id === active ? "bg-on-accent/15" : "bg-raised")}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-3xl", className)} aria-hidden="true" />;
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
