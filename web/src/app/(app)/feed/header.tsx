import { Tabs } from "@/components/app/page-ui";

// Every feed Today can show, each as its own tab (the founders tried two tabs plus a More menu in
// the redesign and went back: every feed one click away reads better than a menu).
export const TABS = [
  { id: "chapter", label: "My chapter" },
  { id: "for-you", label: "For you" },
  { id: "latest", label: "Latest" },
  { id: "following", label: "Following" },
  { id: "communities", label: "Clubs" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

// The top of Today: what needs you first (`hero`: your next step, the log-work box, what's waiting
// on you), then the feed's tabs, which stay pinned while you scroll. "My chapter" only shows for
// chapter members (Linear FIX-71). `filter` is the one Filter menu (order, kind, topics) at the end
// of the tab row.
export function FeedHeader({ tab, hero, hrefFor, filter, chapter = false }: { tab?: TabId; hero?: React.ReactNode; hrefFor?: (t: TabId) => string; filter?: React.ReactNode; chapter?: boolean }) {
  return (
    <header data-tour="feed-tabs" className="flex flex-col gap-4">
      {hero ?? <div className="h-[132px] shimmer rounded-xl" />}
      <div className="sticky top-[var(--m-top)] z-20 bg-bg md:top-0">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><Tabs active={tab ?? ""} tabs={TABS.filter((t) => chapter || t.id !== "chapter").map((t) => ({ id: t.id, label: t.label, href: hrefFor ? hrefFor(t.id) : t.id === "for-you" ? "/feed" : `/feed?tab=${t.id}` }))} /></div>
          {filter}
        </div>
      </div>
    </header>
  );
}
