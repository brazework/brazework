import Link from "next/link";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { WithPresence } from "@/components/presence/presence";

// One member in a network list (personRow() in public/js/network.js).
export function PersonRow({
  person,
  sub,
  note,
  actions,
  className,
}: {
  person: { id: string; firstName: string; lastName: string; headline: string };
  sub?: React.ReactNode;
  note?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const name = `${person.firstName} ${person.lastName}`.trim() || "Forge member";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5", className)}>
      <Link href={`/u/${person.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <WithPresence id={person.id}><Avatar first={person.firstName} last={person.lastName} size={44} /></WithPresence>
      </Link>
      <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
        <Link href={`/u/${person.id}`} className="truncate font-medium hover:underline">{name}</Link>
        {person.headline && <span className="truncate text-sm text-muted">{person.headline}</span>}
        {sub && <span className="text-xs text-faint">{sub}</span>}
        {note && <p className="mt-1.5 rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-text-2">&ldquo;{note}&rdquo;</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

// Small round buttons used across network rows.
export const smallBtn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50";
export const smallPrimary = cn(smallBtn, "bg-accent text-on-accent hover:opacity-90");
export const smallOutline = cn(smallBtn, "border border-line text-text hover:border-line-strong hover:bg-hover");
export const smallGhost = cn(smallBtn, "text-muted hover:bg-hover hover:text-text");
