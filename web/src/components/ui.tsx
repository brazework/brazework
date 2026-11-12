import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/forge";

export function Logo({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M4 22 L14 4 L24 22 Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M9 22 L14 13 L19 22" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      {withWord && <span className="text-[17px]">Brazework</span>}
    </span>
  );
}

type BtnProps = { href?: string; variant?: "primary" | "ghost" | "outline"; size?: "md" | "lg"; className?: string; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ href, variant = "primary", size = "md", className, children, ...rest }: BtnProps) {
  const cls = cn(
    // Redesign 2026-11: calm and precise. 8px corners, no glow, no lift; the colour does the work.
    "group relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 select-none disabled:opacity-50 disabled:pointer-events-none",
    size === "lg" ? "h-11 px-5 text-[15px]" : "h-9 px-3.5 text-sm",
    variant === "primary" && "bg-accent-grad text-on-accent hover:opacity-90 active:opacity-100",
    variant === "outline" && "border border-line bg-surface text-text hover:border-line-strong hover:bg-hover",
    variant === "ghost" && "text-muted hover:bg-hover hover:text-text",
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[11px] uppercase tracking-[0.18em] text-faint", className)}>{children}</div>;
}

export function Avatar({ first, last, size = 40, className, src }: { first: string; last: string; size?: number; className?: string; src?: string | null }) {
  if (src)
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-line-strong bg-raised object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full border border-line-strong bg-raised font-semibold text-text", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {`${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()}
    </span>
  );
}

// A labelled form field. `optional` tags it so required fields need no asterisks; `count`/`max` show a
// live character count that turns amber near the limit; `error` shows inline under the field (pair it
// with aria-invalid on the input so inputCls paints it red).
export function Field({ label, hint, optional, error, count, max, children }: { label: string; hint?: React.ReactNode; optional?: boolean; error?: string; count?: number; max?: number; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2 text-sm font-medium text-text-2">
        {label}
        {optional && <span className="rounded bg-surface-2 px-1.5 py-px text-[10px] font-normal tracking-wide text-faint uppercase">Optional</span>}
        {max !== undefined && count !== undefined && <span className={cn("ml-auto font-mono text-[11px] font-normal tabular-nums", count > max * 0.9 ? "text-amber-500" : "text-faint")}>{count}/{max}</span>}
      </span>
      {children}
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

// Pop-up menus (a post's "...", Host an event): one surface and one item style everywhere.
export const menuCls = "rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-float)]";
export const menuItemCls = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-text-2 transition hover:bg-hover hover:text-text focus-visible:bg-hover focus-visible:outline-none";
// Dropdowns: selectCls for form fields (same as inputs), selectPillCls for compact inline pickers.
// The chevron and spacing come from globals.css, for every <select>.
export const selectPillCls =
  "h-9 max-w-full truncate rounded-lg border border-line bg-surface pl-3 text-sm text-text-2 transition hover:border-line-strong hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50";
export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-text placeholder:text-faint outline-none transition hover:border-line-strong focus:border-line-strong focus:ring-[3px] focus:ring-text/8 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15 disabled:cursor-not-allowed disabled:opacity-60";
