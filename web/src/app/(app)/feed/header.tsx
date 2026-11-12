import { Tabs } from "@/components/app/page-ui";

export const TABS = [
  { id: "chapter", label: "My chapter" },
  { id: "for-you", label: "For you" },
  { id: "latest", label: "Latest" },
  { id: "following", label: "Following" },
  { id: "communities", label: "Clubs" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

// The top of the feed: the create box (a placeholder while it loads) and the tabs, which stay
// pinned (glass) while you scroll. "My chapter" only shows for chapter members (Linear FIX-71).
export function FeedHeader({ tab, hero, hrefFor, sort, chapter = false }: { tab?: TabId; hero?: React.ReactNode; hrefFor?: (t: TabId) => string; sort?: React.ReactNode; chapter?: boolean }) {
  return (
    <header data-tour="feed-tabs" className="flex flex-col gap-4">
      {hero ?? <div className="h-[132px] shimmer rounded-xl" />}
      {/* Sticky as you scroll: a plain bar on the page (redesign 2026-11); the tabs' underline does the work. */}
      <div className="sticky top-[var(--m-top)] z-20 bg-bg md:top-0">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><Tabs active={tab ?? ""} tabs={TABS.filter((t) => chapter || t.id !== "chapter").map((t) => ({ id: t.id, label: t.label, href: hrefFor ? hrefFor(t.id) : t.id === "for-you" ? "/feed" : `/feed?tab=${t.id}` }))} /></div>
          {sort}
        </div>
      </div>
    </header>
  );
}
