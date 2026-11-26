import { onPage } from "@/lib/nav-match";

// The five places of the signed-in app (redesign stage 1; renamed in the flow redesign, 2026-11-19,
// docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md). Each answers one question:
//   Home   what needs me right now?     Projects  what am I making?     Clubs  what's my team doing?
//   Record what have I done, and who signed it?                         Inbox  who's reaching out?
// The routes kept their old names (/feed, /communities, /profile) so no link breaks.
// Every page lives inside one of them. This is the single list the sidebar, the phone tab bar and the
// place tabs read, so "you are here" can't disagree between them. Pure, and tested (tests/places.test.ts).

export type PlaceId = "home" | "school" | "projects" | "clubs" | "record" | "inbox";
// `signing`: results members have asked your clubs to sign, when you're one of their officers.
export type BadgeKey = "notifications" | "messages" | "invites" | "signing";
// `tour`: a tour anchor (data-tour) that moved onto this tab when the More drawer went away.
export type PlaceTab = { id: string; label: string; href: string; badge?: BadgeKey; tour?: string };
// `match`: the pages that light the place up, as whole path segments (lib/nav-match.ts).
export type Place = { id: PlaceId; label: string; href: string; match: string[]; badge?: BadgeKey; tabs: PlaceTab[] };

export const PLACES: Place[] = [
  {
    id: "home", label: "Home", href: "/feed", badge: "notifications",
    match: ["/feed", "/post", "/notifications", "/saved", "/drafts"],
    tabs: [
      { id: "home", label: "Home", href: "/feed" },
      { id: "notifications", label: "Notifications", href: "/notifications", badge: "notifications", tour: "bell" },
    ],
  },
  // One page today (the workbench above Explore); it gets its own tabs when stage 2 splits it.
  { id: "projects", label: "Projects", href: "/projects", match: ["/projects"], tabs: [] },
  {
    id: "clubs", label: "Clubs", href: "/communities", badge: "signing",
    match: ["/communities", "/c", "/events", "/school", "/org", "/challenges", "/chapters"],
    tabs: [
      { id: "clubs", label: "Clubs", href: "/communities" },
      { id: "school", label: "Your school", href: "/school" },
      { id: "events", label: "Events", href: "/events" },
    ],
  },
  {
    id: "record", label: "Record", href: "/profile",
    match: ["/profile", "/u", "/dashboard", "/analytics", "/network", "/settings", "/pro"],
    tabs: [
      { id: "profile", label: "Profile", href: "/profile" },
      { id: "analytics", label: "Analytics", href: "/dashboard" },
    ],
  },
  { id: "inbox", label: "Chats", href: "/messages", badge: "messages", match: ["/messages"], tabs: [] },
];

// School (the student portal, 2026-11-26): a place of its own for anyone placed at a school by their
// email (students, faculty, the school's admins), right after Home. Everyone else keeps the five.
export const SCHOOL_PLACE: Place = { id: "school", label: "School", href: "/school", match: ["/school"], tabs: [] };

/** The places this member sees: School after Home when they're at a school. Clubs then drops its
 * "Your school" tab, since School is a place. */
export function placesFor(atSchool: boolean): Place[] {
  if (!atSchool) return PLACES;
  return [PLACES[0], SCHOOL_PLACE, ...PLACES.slice(1).map((p) => (p.id === "clubs" ? { ...p, match: p.match.filter((m) => m !== "/school"), tabs: p.tabs.filter((t) => t.id !== "school") } : p))];
}

/** The phone's tab bar: five slots. At a school, School takes Chats' slot and Chats moves to the top bar. */
export function phoneTabsFor(atSchool: boolean): Place[] {
  return atSchool ? placesFor(true).filter((p) => p.id !== "inbox") : PLACES;
}

// Which place lights up for this path (null for pages outside them, like Torch's own page).
export function placeFor(path: string, places: Place[] = PLACES): Place | null {
  return places.find((p) => p.match.some((m) => onPage(path, m))) ?? null;
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

// The pages inside the places that the phone's Menu sheet lists, so nothing is more than a tap away
// on a small screen. Since the school-first realignment (2026-11-26, docs/strategy.md) Challenges,
// Saved, Connections and Pro reviews are off the navigation: their pages still answer old links and
// emails, and live under their place, but nothing in the app points at them.
export const MENU_PAGES: { href: string; label: string; badge?: BadgeKey }[] = [
  { href: "/notifications", label: "Notifications", badge: "notifications" },
  { href: "/school", label: "Your school" },
  { href: "/events", label: "Events" },
  { href: "/dashboard", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];
