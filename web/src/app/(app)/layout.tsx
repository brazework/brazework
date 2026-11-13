import { ThemeChrome } from "@/components/theme-chrome";
import { ReportDialog } from "@/components/report/report-dialog";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { PlaceTabs } from "@/components/app/place-tabs";
import { PlaceTabsCounted } from "@/components/app/place-tabs-counted";
import { loadBadges } from "@/lib/badges";
import { QueryProvider } from "@/components/app/query-provider";
import { GlobalSearch } from "@/components/search/global-search";
import { TourMount } from "@/components/tour/tour-mount";
import { PresenceMount } from "@/components/presence/presence";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";
import { CommandPalette } from "@/components/palette/command-palette";
import { dbFeatures } from "@/lib/db-features";
import { MobileBar, SIDEBAR_COOKIE, Sidebar, SidebarSkeleton, type Badges } from "./sidebar";

// The chrome is prerendered; the session read streams in behind Suspense (Cache Components).
// proxy.ts redirects signed-out visitors first; SignedInShell re-checks on the server.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-backdrop min-h-dvh">
    <div className="flex min-h-dvh">
      <Suspense fallback={<SidebarSkeleton />}>
        <SignedInShell />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pt-[var(--m-top)] pb-[calc(var(--m-bottom)+1rem)] sm:px-6 md:py-6 lg:px-8 2xl:px-12">
        {/* One search for people and communities, above every page. On the feed it lines up with the posts column (globals.css). */}
        <div className="search-row mx-auto mb-6 hidden max-w-3xl md:block xl:max-w-4xl"><Suspense fallback={<div className="h-12 rounded-2xl border border-line bg-surface/60" aria-hidden="true" />}><GlobalSearch /></Suspense></div>
        {/* The pages inside the place you're in (lib/places.ts), on phones too. Lines up with the search row. */}
        <div className="place-row mx-auto max-w-3xl xl:max-w-4xl">{/* Two boundaries: the tabs read the path, which on a page with an id in its address isn't known when
            the shell is prerendered, so they wait in the outer one; inside it, the plain tabs show at once
            and the same tabs with their counts take over when the counts arrive. */}
          <Suspense fallback={null}><Suspense fallback={<PlaceTabs />}><PlaceTabsCounted /></Suspense></Suspense></div>
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
    </div>
  );
}

async function SignedInShell() {
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (!profile?.onboarded) redirect("/onboarding");

  // What's waiting for you, shown as badges across the app (supabase/activity.sql, messages.sql).
  const { clubProfile, media } = await dbFeatures();
  const [counts, cl] = await Promise.all([
    // Shared with the place tabs above the page (lib/badges.ts): one set of queries per render.
    loadBadges(),
    // Your clubs, as shortcuts in the sidebar.
    // With their logo (or cover) where they have one.
    supabase.from("community_members").select(`communities(id, name${clubProfile ? ", logo_path" : ""}${media ? ", cover_path" : ""})`).eq("uid", user.id).order("joined_at", { ascending: false }).limit(5),
  ]);
  type ClubRef = { id: string; name: string; logo_path?: string | null; cover_path?: string | null };
  const myClubs = ((cl.data ?? []) as unknown as { communities: ClubRef | ClubRef[] | null }[])
    .flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []))
    .map((c) => ({ id: c.id, name: c.name, image: c.logo_path ?? c.cover_path ?? null }));
  const badges: Badges = counts ?? { notifications: 0, messages: 0, invites: 0 };
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <>
      {/* Badges stay current as things arrive; row-level security limits these to your own rows. */}
      <LiveRefresh tables={["notifications", "conversations", "connections", "chats"]} delay={800} quietOn={["/feed"]} />
      {/* Online status: who has Brazework open right now. */}
      <PresenceMount userId={user.id} />
      <Sidebar first={profile.first_name} last={profile.last_name} userId={user.id} badges={badges} avatar={avatarSrc(profile)} initialCollapsed={collapsed} clubs={myClubs} />
      <CommandPalette />
      <ReportDialog />
      <MobileBar first={profile.first_name} last={profile.last_name} badges={badges} avatar={avatarSrc(profile)} />
      <ThemeChrome />
      <TourMount />
    </>
  );
}
