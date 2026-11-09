import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { GlobalSearch } from "@/components/search/global-search";
import { TourMount } from "@/components/tour/tour-mount";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";
import { MobileBar, SIDEBAR_COOKIE, Sidebar, SidebarSkeleton, type Badges } from "./sidebar";

// The chrome is prerendered; the session read streams in behind Suspense (Cache Components).
// proxy.ts redirects signed-out visitors first; SignedInShell re-checks on the server.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-backdrop min-h-dvh">
    <div className="mx-auto flex min-h-dvh max-w-[1600px] gap-6 px-4 sm:px-6 lg:gap-8">
      <Suspense fallback={<SidebarSkeleton />}>
        <SignedInShell />
      </Suspense>
      <main className="min-w-0 flex-1 pt-20 pb-28 md:py-8">
        {/* One search for people and communities, above every page. */}
        <div className="mx-auto mb-6 max-w-3xl"><Suspense fallback={<div className="h-12 rounded-2xl border border-line bg-surface/60" aria-hidden="true" />}><GlobalSearch /></Suspense></div>
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
  const [n, m, i] = await Promise.all([
    supabase.rpc("unread_notifications"),
    supabase.rpc("unread_conversations"),
    supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", user.id).eq("status", "pending"),
  ]);
  const badges: Badges = { notifications: Number(n.data) || 0, messages: Number(m.data) || 0, invites: i.count ?? 0 };
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <>
      {/* Badges stay current as things arrive; row-level security limits these to your own rows. */}
      <LiveRefresh tables={["notifications", "conversations", "connections"]} delay={800} />
      <Sidebar first={profile.first_name} last={profile.last_name} headline={profile.headline} badges={badges} avatar={avatarSrc(profile)} initialCollapsed={collapsed} />
      <MobileBar first={profile.first_name} last={profile.last_name} badges={badges} avatar={avatarSrc(profile)} />
      <TourMount />
    </>
  );
}
