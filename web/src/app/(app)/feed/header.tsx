import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Tabs } from "@/components/app/page-ui";
import { menuCls, menuItemCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import type { FeedTabs } from "@/lib/feed-tabs";

// Every feed Today can show. Two are tabs (Your clubs, Everyone); the rest sit in the More menu
// (lib/feed-tabs.ts decides which is which).
export const TABS = [
  { id: "chapter", label: "My chapter" },
  { id: "for-you", label: "For you" },
  { id: "latest", label: "Latest" },
  { id: "following", label: "Following" },
  { id: "communities", label: "Clubs" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

// The top of Today: what's yours first (`hero`: your next step, the log-work box, what's waiting on
// you, your builds), then the feed's tabs, which stay pinned while you scroll. `filter` is the one
// Filter menu (sort, kind, topics) at the end of the tab row.
export function FeedHeader({ tabs, hero, hrefFor, filter }: { tabs?: FeedTabs; hero?: React.ReactNode; hrefFor?: (t: TabId) => string; filter?: React.ReactNode }) {
  const href = (t: TabId) => (hrefFor ? hrefFor(t) : t === "for-you" ? "/feed" : `/feed?tab=${t}`);
  return (
    <header data-tour="feed-tabs" className="flex flex-col gap-4">
      {hero ?? <div className="h-[132px] shimmer rounded-xl" />}
      <div className="sticky top-[var(--m-top)] z-20 bg-bg md:top-0">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><Tabs active={tabs?.active ?? ""} tabs={(tabs?.shown ?? []).map((t) => ({ id: t.id, label: t.label, href: href(t.id) }))} /></div>
          {tabs && (
            <details name="feed-menu" key={`${tabs.active}:${tabs.moreLabel}`} className="group relative shrink-0">
              <summary aria-label={tabs.moreLabel === "More" ? "More feeds" : `Feed: ${tabs.moreLabel}`} className={cn("flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition [&::-webkit-details-marker]:hidden", tabs.moreLabel === "More" ? "text-muted hover:bg-hover hover:text-text" : "bg-raised text-text")}>
                {tabs.moreLabel} <ChevronDown className="size-3 transition group-open:rotate-180" />
              </summary>
              <div className={cn(menuCls, "absolute top-full right-0 z-30 mt-1.5 w-44")}>
                {tabs.more.map((m) => <Link key={m.id} href={href(m.id)} aria-current={tabs.moreLabel === m.label ? "true" : undefined} className={cn(menuItemCls, tabs.moreLabel === m.label && "font-medium text-text")}>{m.label}</Link>)}
              </div>
            </details>
          )}
          {filter}
        </div>
      </div>
    </header>
  );
}
