import { Tabs } from "@/components/app/page-ui";

export const TABS = [
  { id: "for-you", label: "For you" },
  { id: "latest", label: "Latest" },
  { id: "following", label: "Following" },
  { id: "communities", label: "Communities" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

// The top of the feed (the Copilot hero when given, else a welcome banner) and the tabs, which stay
// pinned (glass) while you scroll.
export function FeedHeader({ tab, first, hero }: { tab?: TabId; first?: string; hero?: React.ReactNode }) {
  return (
    <header data-tour="feed-tabs" className="flex flex-col gap-4">
      {hero ?? <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <div className="bg-accent-grad pointer-events-none absolute -top-24 -right-16 size-64 rounded-full banner-glow blur-3xl" aria-hidden="true" />
        <p className="text-sm text-muted">{first ? `Welcome back, ${first}` : "Welcome back"}</p>
        <h1 className="text-grad mt-1 text-3xl font-semibold tracking-tight">What&apos;s being built</h1>
        <p className="mt-1.5 max-w-md text-sm text-muted">Projects, results and questions from your fields and your clubs.</p>
      </div>}
      <div className="glass sticky top-16 z-20 -mx-1 rounded-2xl p-1 md:top-3">
        <Tabs active={tab ?? ""} tabs={TABS.map((t) => ({ id: t.id, label: t.label, href: t.id === "for-you" ? "/feed" : `/feed?tab=${t.id}` }))} />
      </div>
    </header>
  );
}
