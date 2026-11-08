import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/supabase/server";
import { MobileBar, Sidebar, SidebarSkeleton } from "./sidebar";

// The chrome is prerendered; the session read streams in behind Suspense (Cache Components).
// proxy.ts redirects signed-out visitors first; SignedInSidebar re-checks on the server.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl gap-8 px-4 sm:px-6">
      <Suspense fallback={<SidebarSkeleton />}>
        <SignedInSidebar />
      </Suspense>
      <main className="min-w-0 flex-1 pt-20 pb-8 md:py-8">{children}</main>
    </div>
  );
}

async function SignedInSidebar() {
  const { user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (!profile?.onboarded) redirect("/onboarding");
  return (
    <>
      <Sidebar first={profile.first_name} last={profile.last_name} headline={profile.headline} />
      <div className="fixed inset-x-0 top-0 z-40 px-4 md:hidden"><MobileBar first={profile.first_name} last={profile.last_name} /></div>
    </>
  );
}
