import type { Metadata } from "next";
import { ArrowLeft, Flame, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { dbFeatures } from "@/lib/db-features";
import { COMMUNITY_COLS, rank, type Community, type Role } from "@/lib/communities";
import { getViewer } from "@/lib/supabase/server";
import { requestTime } from "@/lib/forge";
import { CommunityCard, CommunityGrid, type Pulse } from "./community-grid";
import { Carousel } from "@/components/app/carousel";
import { CreateCommunity } from "./create-form";
import { StartChapterCard } from "@/components/app/start-chapter";

export const metadata: Metadata = { title: "Communities" };

export default function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  return (
    <div className="mx-auto max-w-4xl 2xl:max-w-6xl">
      <Suspense fallback={<><PageHeader title="Clubs" /><Skeleton className="mt-6 h-96" /></>}>
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

  // Each club's pulse: a few faces, who's online (live, on the card) and posts this week.
  const pulseIds = [...joined.map((j) => j.c.id), ...discover.slice(0, 60).map((c) => c.id)];
  const weekAgo = new Date(requestTime() - 7 * 864e5).toISOString();
  const [memberRows, weekRows] = pulseIds.length
    ? await Promise.all([
        supabase.from("community_members").select("community_id, uid, first_name, last_name").in("community_id", pulseIds).order("joined_at", { ascending: false }).limit(2000),
        supabase.from("posts").select("community_id").in("community_id", pulseIds).eq("status", "visible").gt("created_at", weekAgo).limit(3000),
      ])
    : [{ data: [] }, { data: [] }];
  const pulse: Record<string, Pulse> = {};
  const at = (id: string) => (pulse[id] ??= { faces: [], ids: [], week: 0 });
  for (const m of (memberRows.data ?? []) as { community_id: string; uid: string; first_name: string; last_name: string }[]) {
    const p = at(m.community_id);
    p.ids.push(m.uid);
    if (p.faces.length < 5) p.faces.push({ uid: m.uid, first: m.first_name, last: m.last_name });
  }
  for (const r of (weekRows.data ?? []) as { community_id: string }[]) at(r.community_id).week++;

  // Your clubs also show what's next on their calendar, and (where you're an officer) how many
  // results are waiting for a signature. Row-level security shows pending milestones to officers only.
  const f = await dbFeatures();
  const now = requestTime();
  const mineIds = joined.map((j) => j.c.id), officerIds = joined.filter((j) => rank(j.role) >= 3).map((j) => j.c.id);
  const [evRows, msRows] = await Promise.all([
    f.clubEvents && mineIds.length ? supabase.from("events").select("id, title, starts_at, community_id").in("community_id", mineIds).eq("status", "published").gt("starts_at", new Date(now).toISOString()).order("starts_at", { ascending: true }).limit(60) : Promise.resolve({ data: [] }),
    f.milestones && officerIds.length ? supabase.from("milestones").select("community_id").in("community_id", officerIds).eq("status", "pending").neq("owner_id", user.id).limit(500) : Promise.resolve({ data: [] }),
  ]);
  for (const e of (evRows.data ?? []) as { id: string; title: string; starts_at: string; community_id: string }[]) {
    const p = at(e.community_id);
    if (!p.next) {
      const days = Math.max(0, Math.round((Date.parse(e.starts_at) - now) / 864e5));
      p.next = { id: e.id, title: e.title, when: days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days` };
    }
  }
  for (const m of (msRows.data ?? []) as { community_id: string }[]) { const p = at(m.community_id); p.verify = (p.verify ?? 0) + 1; }

  return (
    <>
      {/* One row of tabs is enough (the place tabs above: Clubs, Events, Challenges). Finding and
          starting a club are two buttons here, and each of those views has a way back. */}
      <PageHeader
        title={tab === "discover" ? "Find a club" : tab === "create" ? "Start a club" : "Your clubs"}
        subtitle={tab === "mine" ? "Your chapter, team or lab: members, events, chat and the work you verify, in one place." : tab === "discover" ? "Clubs in your field first, then the biggest." : "For the chapter, team or lab that isn't here yet."}
        actions={tab === "mine" ? <>
          <Link href="/communities?tab=discover" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-medium transition hover:bg-hover"><Search className="size-4" /> Find a club</Link>
          <Link href="/communities?tab=create" className="bg-accent-grad inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent"><Plus className="size-4" /> Start a club</Link>
        </> : <Link href="/communities?tab=mine" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-medium transition hover:bg-hover"><ArrowLeft className="size-4" /> Your clubs</Link>}
      />
      <div className="mt-6">
        {tab === "mine" && (
          <CommunityGrid
            items={joined.map((j) => ({ c: j.c, role: j.role, pulse: pulse[j.c.id] }))}
            empty={<EmptyState icon={<Users className="size-6" />} title="You haven't joined a community yet" body="Find your club, or start the one your field is missing." action={<Link href="/communities?tab=discover" className="text-sm underline underline-offset-4">Discover communities</Link>} />}
          />
        )}
        {/* Clubs you might join come after your own, not before them. */}
        {tab === "mine" && discover.length > 0 && (
          <Carousel className="mt-10" title={profile.field ? `Popular in ${profile.field}` : "Popular on Brazework"} icon={<Flame className="size-3.5" />} href="/communities?tab=discover" hrefLabel="Find a club">
            {discover.slice(0, 10).map((c) => <div key={c.id} className="w-[300px]"><CommunityCard c={c} joinable pulse={pulse[c.id]} /></div>)}
          </Carousel>
        )}
        {tab === "discover" && (
          <CommunityGrid
            discover
            initialQuery={q}
            items={discover.map((c) => ({ c, pulse: pulse[c.id] }))}
            empty={<EmptyState icon={<Users className="size-6" />} title="No other communities yet" body="Start the one your field is missing." action={<Link href="/communities?tab=create" className="text-sm underline underline-offset-4">Create a community</Link>} />}
          />
        )}
        {tab === "create" && <Suspense fallback={null}><StartChapterCard className="mb-4" /></Suspense>}
        {tab === "create" && <Panel className="p-6"><CreateCommunity interests={profile.interests ?? []} field={profile.field} /></Panel>}
      </div>
    </>
  );
}
