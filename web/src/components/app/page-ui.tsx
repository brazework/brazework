import Link from "next/link";
import { cn } from "@/lib/forge";

// Shared building blocks for signed-in pages, so every screen looks like one product.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-grad text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-3xl border border-line bg-surface/80 p-5 shadow-[var(--shadow)] backdrop-blur-sm", className)}>{children}</section>;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-raised text-muted">{icon}</div>}
      <div className="font-medium">{title}</div>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
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
            "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition",
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
  return <div className={cn("animate-pulse rounded-3xl bg-surface/80", className)} aria-hidden="true" />;
}

export const chipCls = "rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted";
