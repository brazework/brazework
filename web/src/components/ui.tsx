import Link from "next/link";
import { cn } from "@/lib/forge";

export function Logo({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="forge-mark" x1="4" y1="22" x2="24" y2="4" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--ember)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <path d="M4 22 L14 4 L24 22 Z" stroke="url(#forge-mark)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 22 L14 13 L19 22" stroke="url(#forge-mark)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      {withWord && <span className="text-[17px]">Forge</span>}
    </span>
  );
}

type BtnProps = { href?: string; variant?: "primary" | "ghost" | "outline"; size?: "md" | "lg"; className?: string; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ href, variant = "primary", size = "md", className, children, ...rest }: BtnProps) {
  const cls = cn(
    "group relative inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 select-none disabled:opacity-50 disabled:pointer-events-none",
    size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
    variant === "primary" &&
      "bg-accent text-on-accent shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_60%,white)_inset,0_8px_30px_-6px_color-mix(in_oklab,var(--accent)_70%,transparent)] hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_60%,white)_inset,0_12px_44px_-6px_var(--accent)] hover:-translate-y-px active:translate-y-0",
    variant === "outline" && "glass text-text hover:bg-hover hover:border-line-strong",
    variant === "ghost" && "text-muted hover:text-text",
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[11px] uppercase tracking-[0.18em] text-accent", className)}>{children}</div>;
}

export function Avatar({ first, last, size = 40, className }: { first: string; last: string; size?: number; className?: string }) {
  const hue = ((first.charCodeAt(0) || 70) * 7 + (last.charCodeAt(0) || 70) * 3) % 50; // stays in the warm range
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-on-accent", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${20 + hue} 95% 62%), hsl(${hue} 90% 52%))` }}
      aria-hidden="true"
    >
      {`${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-[15px] text-text placeholder:text-faint outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";
