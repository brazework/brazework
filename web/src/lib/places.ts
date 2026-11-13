import { onPage } from "@/lib/nav-match";

// The five places of the signed-in app (redesign stage 1). Each answers one question:
//   Today  what needs me right now?      Build  what am I making?      Club  what's my team doing?
//   Proof  what have I proven, and who looked?                         Inbox who's reaching out?
// Every page lives inside one of them. This is the single list the sidebar, the phone tab bar and the
// place tabs read, so "you are here" can't disagree between them. Pure, and tested (tests/places.test.ts).

export type PlaceId = "today" | "build" | "club" | "proof" | "inbox";
export type BadgeKey = "notifications" | "messages" | "invites";
// `tour`: a tour anchor (data-tour) that moved onto this tab when the More drawer went away.
export type PlaceTab = { id: string; label: string; href: string; badge?: BadgeKey; tour?: string };
// `match`: the pages that light the place up, as whole path segments (lib/nav-match.ts).
export type Place = { id: PlaceId; label: string; href: string; match: string[]; badge?: BadgeKey; tabs: PlaceTab[] };

export const PLACES: Place[] = [
  {
    id: "today", label: "Today", href: "/feed", badge: "notifications",
    match: ["/feed", "/post", "/notifications", "/saved"],
    tabs: [
      { id: "today", label: "Today", href: "/feed" },
      { id: "notifications", label: "Notifications", href: "/notifications", badge: "notifications", tour: "bell" },
      { id: "saved", label: "Saved", href: "/saved" },
    ],
  },
  // One page today (the workbench above Explore); it gets its own tabs when stage 2 splits it.
  { id: "build", label: "Build", href: "/projects", match: ["/projects"], tabs: [] },
  {
    id: "club", label: "Club", href: "/communities",
    match: ["/communities", "/c", "/events", "/org", "/challenges", "/chapters"],
    tabs: [
      { id: "clubs", label: "Clubs", href: "/communities" },
      { id: "events", label: "Events", href: "/events" },
      { id: "challenges", label: "Challenges", href: "/challenges" },
    ],
  },
  {
    id: "proof", label: "Proof", href: "/profile", badge: "invites",
    match: ["/profile", "/u", "/dashboard", "/analytics", "/network", "/settings", "/pro"],
    tabs: [
      { id: "profile", label: "Profile", href: "/profile" },
      { id: "connections", label: "Connections", href: "/network", badge: "invites" },
      { id: "analytics", label: "Analytics", href: "/dashboard" },
      { id: "pro", label: "Pro reviews", href: "/pro" },
    ],
  },
  { id: "inbox", label: "Inbox", href: "/messages", badge: "messages", match: ["/messages"], tabs: [] },
];

// Which place lights up for this path (null for pages outside the five, like Ember's own page).
export function placeFor(path: string): Place | null {
  return PLACES.find((p) => p.match.some((m) => onPage(path, m))) ?? null;
}

// The tab row for this page, if it has one: only a place's own top pages, never a detail page under
// them (/events shows it, /events/<id> doesn't). /profile redirects to /u/<you>, and only you get
// tabs there, so the profile page renders its own row (PlaceTabsRow).
export function placeTabsFor(path: string): { place: Place; active: string } | null {
  const at = path.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  for (const place of PLACES) {
    const tab = place.tabs.find((t) => t.href === at && t.href !== "/profile");
    if (tab) return { place, active: tab.id };
  }
  return null;
}

// The pages the old More drawer listed. Each now lives inside a place (a tab, or the avatar menu);
// the phone's Menu sheet still lists them all, so nothing is more than a tap away on a small screen.
export const MENU_PAGES: { href: string; label: string; badge?: BadgeKey }[] = [
  { href: "/notifications", label: "Notifications", badge: "notifications" },
  { href: "/events", label: "Events" },
  { href: "/challenges", label: "Challenges" },
  { href: "/pro", label: "Pro reviews" },
  { href: "/saved", label: "Saved" },
  { href: "/network", label: "Connections", badge: "invites" },
  { href: "/dashboard", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];
