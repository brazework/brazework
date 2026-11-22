import { Sparkle } from "lucide-react";
import { cn } from "@/lib/forge";

// "Founding member #12": one of the first 1,000 members (supabase/founding-members.sql, FIX-241).
// The number never changes. The perk that comes with it is still being decided, so the badge only
// says what it is. `compact`: just the mark and number, for beside a name in a list.
export function FoundingBadge({ n, compact = false, className }: { n: number; compact?: boolean; className?: string }) {
  const title = `Founding member #${n}: one of the first 1,000 people on Brazework`;
  return compact ? (
    <span title={title} aria-label={title} className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-text", className)}>
      <Sparkle className="size-2.5" aria-hidden="true" /> #{n}
    </span>
  ) : (
    <span data-founding title={title} className={cn("inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3 py-1 text-xs font-medium text-text", className)}>
      <Sparkle className="size-3.5" aria-hidden="true" /> Founding member <span className="font-mono text-muted">#{n}</span>
    </span>
  );
}
