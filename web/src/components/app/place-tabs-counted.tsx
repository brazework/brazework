import { loadBadges } from "@/lib/badges";
import { PlaceTabs, PlaceTabsRow } from "./place-tabs";

// The place tabs with their counts (unread notifications on Today's Notifications tab, pending
// invites on Proof's Connections tab), so a number on the sidebar leads to the tab that explains it.
// The counts come from the same once-per-render loader the sidebar uses (lib/badges.ts).
export async function PlaceTabsCounted() {
  return <PlaceTabs badges={(await loadBadges()) ?? undefined} />;
}

// Your own profile is Proof's first page; only you see the tabs there.
export async function OwnProofTabs() {
  return <PlaceTabsRow place="proof" active="profile" badges={(await loadBadges()) ?? undefined} />;
}
