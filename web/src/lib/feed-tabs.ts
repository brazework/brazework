// Today's feed tabs (redesign stage 1). Two show: Your clubs and Everyone. The other feeds (Latest,
// Following, and for chapter members every club at once) are one menu away. They stay the separate
// feeds they are in the database (supabase/feed-pages.sql), so every old link (?tab=latest…) still
// works. Pure, and tested (tests/feed-tabs.test.ts).

export type FeedTabId = "chapter" | "for-you" | "latest" | "following" | "communities";
export type FeedTabs = {
  /** Always two: Your clubs, then Everyone. */
  shown: { id: FeedTabId; label: "Your clubs" | "Everyone" }[];
  /** The feeds in the More menu. */
  more: { id: FeedTabId; label: string }[];
  /** The lit tab, or "" when the current feed is one from the More menu. */
  active: FeedTabId | "";
  /** "More", or the name of the menu feed you're on. */
  moreLabel: string;
};

export function feedTabs(current: FeedTabId, hasChapter: boolean): FeedTabs {
  // A chapter member's clubs tab is their chapter's own feed (their home); everyone else's is the
  // feed of every club they've joined.
  const clubs: FeedTabId = hasChapter ? "chapter" : "communities";
  const shown: FeedTabs["shown"] = [{ id: clubs, label: "Your clubs" }, { id: "for-you", label: "Everyone" }];
  const more: FeedTabs["more"] = [
    { id: "latest", label: "Latest" },
    { id: "following", label: "Following" },
    ...(hasChapter ? [{ id: "communities" as const, label: "All my clubs" }] : []),
  ];
  const picked = more.find((m) => m.id === current);
  return { shown, more, active: picked ? "" : shown.some((s) => s.id === current) ? current : "", moreLabel: picked?.label ?? "More" };
}
