import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton, Tabs } from "@/components/app/page-ui";
import { COMMUNITY_COLS, type Community, type Role } from "@/lib/communities";
import { getViewer } from "@/lib/supabase/server";
import { CommunityGrid } from "./community-grid";
import { CreateCommunity } from "./create-form";

export const metadata: Metadata = { title: "Communities" };

export default function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<><PageHeader title="Communities" /><Skeleton className="mt-6 h-96" /></>}>
        <Communities searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Communities({ searchParams }: { searchParams: PageProps<"/communities">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const [mine, top] = await Promise.all([
    supabase.from("community_members").select(`role, joined_at, communities(${COMMUNITY_COLS})`).eq("uid", user.id).limit(100),
    supabase.from("communities").select(COMMUNITY_COLS).order("member_count", { ascending: false }).limit(200),
  ]);
  const joined = ((mine.data ?? []) as unknown as { role: Role; communities: Community | null }[]).filter((r) => r.communities).map((r) => ({ role: r.role, c: r.communities! }));
  const tab = sp.tab === "discover" || sp.tab === "create" ? sp.tab : joined.length ? "mine" : "discover";
  const joinedIds = new Set(joined.map((j) => j.c.id));
  const interests = new Set<string>(profile.interests ?? []);
  // Search runs in the grid as you type; ?q= just pre-fills it.
  const discover = ((top.data ?? []) as Community[]).filter((c) => !joinedIds.has(c.id));
  // Communities in your field or topics first, then the biggest.
  const fit = (c: Community) => (c.topics ?? []).filter((t) => interests.has(t)).length * 2 + (c.field === profile.field ? 1 : 0);
  discover.sort((a, b) => fit(b) - fit(a) || b.member_count - a.member_count);

  return (
    <>
      <PageHeader title="Communities" subtitle="Clubs, study groups and project teams, each with its own feed, roles and rules." />
      <div className="mt-6">
        <Tabs active={tab} tabs={[
          { id: "mine", label: "Yours", href: "/communities?tab=mine", count: joined.length },
          { id: "discover", label: "Discover", href: "/communities?tab=discover" },
          { id: "create", label: "Create", href: "/communities?tab=create" },
        ]} />
      </div>
      <div className="mt-6">
        {tab === "mine" && (
          <CommunityGrid
            items={joined.map((j) => ({ c: j.c, role: j.role }))}
            empty={<EmptyState icon={<Users className="size-6" />} title="You haven't joined a community yet" body="Find your club, or start the one your field is missing." action={<Link href="/communities?tab=discover" className="text-sm underline underline-offset-4">Discover communities</Link>} />}
          />
        )}
        {tab === "discover" && (
          <CommunityGrid
            discover
            initialQuery={q}
            items={discover.map((c) => ({ c }))}
            empty={<EmptyState icon={<Users className="size-6" />} title="No other communities yet" body="Start the one your field is missing." action={<Link href="/communities?tab=create" className="text-sm underline underline-offset-4">Create a community</Link>} />}
          />
        )}
        {tab === "create" && <Panel className="p-6"><CreateCommunity interests={profile.interests ?? []} field={profile.field} /></Panel>}
      </div>
    </>
  );
}
