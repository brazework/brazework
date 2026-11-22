import { Sparkle } from "lucide-react";
import { cn } from "@/lib/forge";

// "Founding Member": one of the first 1,000 members (supabase/founding-members.sql, FIX-241). The
// database keeps an order number for each, but the badge doesn't show it: being a founding member is
// what matters. `compact`: just the mark, for beside a name in a list.
const TITLE = "Founding Member: one of the first 1,000 people on Brazework";

export function FoundingBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
  return compact ? (
    <span title={TITLE} aria-label={TITLE} className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-text", className)}>
      <Sparkle className="size-3" aria-hidden="true" />
    </span>
  ) : (
    <span data-founding title={TITLE} className={cn("inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3 py-1 text-xs font-medium text-text", className)}>
      <Sparkle className="size-3.5" aria-hidden="true" /> Founding Member
    </span>
  );
}
