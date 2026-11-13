"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/forge";
import { PLACES, placeTabsFor, type BadgeKey, type PlaceId } from "@/lib/places";

// The pages inside a place, one click away (redesign stage 1): Club shows Clubs · Events · Challenges,
// Proof shows Profile · Connections · Analytics · Pro reviews, and so on (lib/places.ts). It replaces
// the sidebar's More drawer. Deliberately quieter than a page's own tabs: small text, no underline bar,
// so a page that has both reads as "where am I" above "what am I looking at".
export function PlaceTabsRow({ place, active, badges }: { place: PlaceId; active: string; badges?: Partial<Record<BadgeKey, number>> }) {
  const p = PLACES.find((x) => x.id === place);
  if (!p || !p.tabs.length) return null;
  return (
    <nav aria-label={`${p.label} pages`} className="no-scrollbar -mx-1 mb-4 flex items-center gap-1 overflow-x-auto px-1">
      {p.tabs.map((t) => {
        const on = t.id === active;
        const count = t.badge ? badges?.[t.badge] ?? 0 : 0;
        return (
          <Link key={t.id} href={t.href} data-tour={t.tour} aria-current={on ? "page" : undefined}
            className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] whitespace-nowrap transition", on ? "bg-raised font-medium text-text" : "text-muted hover:bg-hover hover:text-text")}>
            {t.label}
            {count > 0 && <span className="rounded bg-accent px-1 font-mono text-[10px] leading-4 text-on-accent tabular-nums">{count > 99 ? "99+" : count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

// In the app layout, above every page: shows the row on a place's own top pages and nothing on
// detail pages. Your own profile renders PlaceTabsRow itself (only you get tabs on /u/<you>).
export function PlaceTabs({ badges }: { badges?: Partial<Record<BadgeKey, number>> }) {
  const at = placeTabsFor(usePathname());
  return at ? <PlaceTabsRow place={at.place.id} active={at.active} badges={badges} /> : null;
}
