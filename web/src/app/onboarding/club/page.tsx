import type { Metadata } from "next";
import { ArrowRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";
import { COMMUNITY_COLS, type Community } from "@/lib/communities";
import { getViewer } from "@/lib/supabase/server";
import { CommunityCard } from "../../(app)/communities/community-grid";
import { StartChapterCard } from "@/components/app/start-chapter";

export const metadata: Metadata = { title: "Find your club" };

// Onboarding, step two: your club. It's where your work gets verified, so it comes before the feed.
// Clubs in your field and topics first; skip if yours isn't here yet.
export default function FindYourClubPage() {
  return (
    <div className="relative isolate min-h-dvh">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="mx-auto max-w-4xl px-6 py-14">
        <Logo />
        <div className="mt-14">
          <Suspense fallback={<div className="h-96 shimmer rounded-3xl" aria-busy="true" />}>
            <FindYourClub />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function FindYourClub() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");
  const [mine, top] = await Promise.all([
    supabase.from("community_members").select("community_id").eq("uid", user.id).limit(1),
    supabase.from("communities").select(COMMUNITY_COLS).order("member_count", { ascending: false }).limit(200),
  ]);
  if (mine.data?.length) redirect("/feed");
  const interests = new Set<string>(profile.interests ?? []);
  const fit = (c: Community) => (c.topics ?? []).filter((t) => interests.has(t)).length * 2 + (c.field === profile.field ? 1 : 0);
  const clubs = ((top.data ?? []) as Community[]).sort((a, b) => fit(b) - fit(a) || b.member_count - a.member_count).slice(0, 6);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.06em] text-faint uppercase">Step 4 of 4</p>
        {/* On phones the cards are long; skipping shouldn't need a scroll. */}
        <Link href="/feed" className="text-sm text-muted hover:text-text sm:hidden">Skip</Link>
      </div>
      <h1 className="text-grad mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Find your club</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">Your club&apos;s officers are the people who verify what you build, so it&apos;s the first thing to set up. Join yours, or start it if it isn&apos;t here yet.</p>
      {clubs.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => <CommunityCard key={c.id} c={c} joinable />)}
        </div>
      ) : (
        <p className="mt-8 rounded-3xl border border-dashed border-line p-6 text-sm text-muted">No clubs yet at your school. Start yours: it takes a minute, and you can invite members with a link.</p>
      )}
      <StartChapterCard className="mt-4" />
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/communities?tab=discover" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm transition hover:bg-hover"><Search className="size-4" /> Search all clubs</Link>
        <Link href="/communities?tab=create" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm transition hover:bg-hover"><Plus className="size-4" /> Start your club</Link>
        <Link href="/feed" className="ml-auto inline-flex h-10 items-center gap-1.5 px-2 text-sm text-muted transition hover:text-text">Skip for now <ArrowRight className="size-4" /></Link>
      </div>
    </>
  );
}
