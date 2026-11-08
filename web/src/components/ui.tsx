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
      {withWord && <span className="text-[17px]">Forge</span>}
    </span>
  );
}

type BtnProps = { href?: string; variant?: "primary" | "ghost" | "outline"; size?: "md" | "lg"; className?: string; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ href, variant = "primary", size = "md", className, children, ...rest }: BtnProps) {
  const cls = cn(
    "group relative inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 select-none disabled:opacity-50 disabled:pointer-events-none",
    size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
    variant === "primary" && "bg-accent-grad text-on-accent shadow-[0_8px_24px_-10px_var(--accent)] hover:-translate-y-px hover:shadow-[0_12px_32px_-10px_var(--accent)] hover:brightness-105 active:translate-y-0",
    variant === "outline" && "glass text-text hover:bg-hover hover:border-line-strong",
    variant === "ghost" && "text-muted hover:text-text",
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
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-[15px] text-text placeholder:text-faint outline-none transition focus:border-text focus:ring-4 focus:ring-text/10";
