import { ThemeChrome } from "@/components/theme-chrome";
import { ReportDialog } from "@/components/report/report-dialog";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
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
        {children}
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
  const groupChats = (await dbFeatures()).groupChats;
  const [n, m, i, g, cl] = await Promise.all([
    supabase.rpc("unread_notifications"),
    supabase.rpc("unread_conversations"),
    supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", user.id).eq("status", "pending"),
    groupChats ? supabase.rpc("unread_chats") : Promise.resolve({ data: 0 }),
    // Your clubs, as shortcuts in the sidebar.
    supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).order("joined_at", { ascending: false }).limit(5),
  ]);
  type ClubRef = { id: string; name: string };
  const myClubs = ((cl.data ?? []) as unknown as { communities: ClubRef | ClubRef[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []));
  const badges: Badges = { notifications: Number(n.data) || 0, messages: (Number(m.data) || 0) + (Number(g.data) || 0), invites: i.count ?? 0 };
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <>
      {/* Badges stay current as things arrive; row-level security limits these to your own rows. */}
      <LiveRefresh tables={["notifications", "conversations", "connections", "chats"]} delay={800} />
      {/* Online status: who has Forge open right now. */}
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
