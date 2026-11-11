import Link from "next/link";
import { cn } from "@/lib/forge";

// The verified seal (Linear FIX-71): a scalloped rosette with a check, in the theme's "ok" green. It
// only ever marks work a club's officer signed off, so it has its own shape (no other icon looks like
// it) and always comes with who verified it: "Verified by NSBE - University of Hartford".
const POINTS = 24;
const rosette = Array.from({ length: POINTS }, (_, i) => {
  const a = (i / POINTS) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 === 0 ? 50 : 44;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

// tone "pro" is the gold seal of a Pro sign-off (an engineer at a verified company, FIX-72).
export function Seal({ size = 20, className, tone = "club" }: { size?: number; className?: string; tone?: "club" | "pro" }) {
  const c = tone === "pro" ? "var(--pro)" : "var(--ok)";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className={cn("shrink-0", tone === "pro" ? "drop-shadow-[0_2px_6px_color-mix(in_oklab,var(--pro)_50%,transparent)]" : "drop-shadow-[0_2px_6px_color-mix(in_oklab,var(--ok)_45%,transparent)]", className)}>
      <polygon points={rosette} fill={c} />
      <circle cx="50" cy="50" r="33" fill="none" stroke="white" strokeOpacity="0.45" strokeWidth="3" />
      <path d="M34 51 L45 62 L67 39" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The full stamp: the seal, "Verified by <club>", and who checked it, when.
export function VerifiedStamp({ club, clubId, by, when, size = "md", className }: { club: string; clubId?: string; by?: string | null; when?: string | null; size?: "sm" | "md"; className?: string }) {
  const name = clubId ? <Link href={`/c/${clubId}`} className="hover:underline">{club}</Link> : club;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Seal size={size === "sm" ? 18 : 28} />
      <span className="min-w-0 leading-tight">
        <span className={cn("block truncate font-semibold text-text", size === "sm" ? "text-xs" : "text-sm")}>Verified by {name}</span>
        {(by || when) && <span className="block truncate text-[11px] text-faint">{by ? `Checked by ${by}` : "Checked by an officer"}{when ? ` · ${when}` : ""}</span>}
      </span>
    </span>
  );
}

// A Pro sign-off: the gold seal, who signed (name, title, employer), and what they checked.
export function ProStamp({ name, title, employer, note, when, className }: { name: string; title: string; employer: string; note?: string | null; when?: string | null; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      <Seal size={26} tone="pro" />
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold text-text">Pro-verified by {name}</p>
        <p className="text-[11px] text-faint">{title} at {employer}{when ? ` · ${when}` : ""}</p>
        {note && <p className="mt-1 text-xs leading-relaxed text-text-2">&ldquo;{note}&rdquo;</p>}
      </div>
    </div>
  );
}
