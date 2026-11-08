import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { TourMount } from "@/components/tour/tour-mount";
import { getViewer } from "@/lib/supabase/server";
import { MobileBar, Sidebar, SidebarSkeleton, type Badges } from "./sidebar";

// The chrome is prerendered; the session read streams in behind Suspense (Cache Components).
// proxy.ts redirects signed-out visitors first; SignedInShell re-checks on the server.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl gap-8 px-4 sm:px-6">
      <Suspense fallback={<SidebarSkeleton />}>
        <SignedInShell />
      </Suspense>
      <main className="min-w-0 flex-1 pt-20 pb-28 md:py-8">{children}</main>
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

  return (
    <>
      {/* Badges stay current as things arrive; row-level security limits these to your own rows. */}
      <LiveRefresh tables={["notifications", "conversations", "connections"]} delay={800} />
      <Sidebar first={profile.first_name} last={profile.last_name} headline={profile.headline} badges={badges} />
      <MobileBar first={profile.first_name} last={profile.last_name} badges={badges} />
      <TourMount />
    </>
  );
}
