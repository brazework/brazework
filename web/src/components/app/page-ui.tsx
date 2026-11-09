import Link from "next/link";
import { cn } from "@/lib/forge";

// Shared building blocks for signed-in pages, so every screen looks like one product.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
      <div className="bg-accent-grad pointer-events-none absolute -top-24 -right-16 size-64 rounded-full banner-glow blur-3xl" aria-hidden="true" />
      <div className="relative min-w-0">
        <h1 className="text-grad text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="relative flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-3xl border border-line bg-surface/80 p-5 shadow-[var(--shadow)] backdrop-blur-sm", className)}>{children}</section>;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <div className="bg-accent-grad pointer-events-none absolute top-6 left-1/2 size-40 -translate-x-1/2 rounded-full banner-glow blur-3xl" aria-hidden="true" />
      {icon && <div className="float-y relative mb-4 grid size-14 place-items-center rounded-2xl bg-accent-grad text-on-accent shadow-[0_12px_30px_-10px_var(--accent)]">{icon}</div>}
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
