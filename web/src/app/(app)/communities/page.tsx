import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton, Tabs } from "@/components/app/page-ui";
import { COMMUNITY_COLS, PRIVACY_LABEL, TYPE_LABEL, membersLabel, type Community, type Role } from "@/lib/communities";
import { getViewer } from "@/lib/supabase/server";
import { CommunityBadge, MetaLine, RoleChip } from "./_components/badge";
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
  let discover = ((top.data ?? []) as Community[]).filter((c) => !joinedIds.has(c.id));
  if (q) discover = discover.filter((c) => `${c.name} ${c.about} ${c.field} ${(c.topics ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  // Communities in your field or topics first, then the biggest.
  const fit = (c: Community) => (c.topics ?? []).filter((t) => interests.has(t)).length * 2 + (c.field === profile.field ? 1 : 0);
  discover.sort((a, b) => fit(b) - fit(a) || b.member_count - a.member_count);

  const card = (c: Community, role?: Role) => (
    <Link key={c.id} href={`/c/${c.id}`} className="group flex gap-4 rounded-3xl border border-line bg-surface/70 p-5 transition hover:-translate-y-0.5 hover:border-line-strong">
      <CommunityBadge id={c.id} name={c.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold group-hover:underline">{c.name}</span>
          {role && role !== "member" && <RoleChip role={role} />}
        </div>
        <MetaLine parts={[membersLabel(c.member_count), PRIVACY_LABEL[c.privacy], c.field, TYPE_LABEL[c.type]]} />
        <p className="mt-2 line-clamp-2 text-sm text-text-2">{c.about}</p>
      </div>
    </Link>
  );

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
        {tab === "mine" &&
          (joined.length ? <div className="grid gap-3 sm:grid-cols-2">{joined.map((j) => card(j.c, j.role))}</div> : (
            <EmptyState icon={<Users className="size-5" />} title="You haven't joined a community yet" action={<Link href="/communities?tab=discover" className="text-sm underline underline-offset-4">Discover communities</Link>} />
          ))}
        {tab === "discover" && (
          <>
            <form action="/communities" className="mb-4">
              <input type="hidden" name="tab" value="discover" />
              <label htmlFor="cq" className="sr-only">Search communities</label>
              <input id="cq" name="q" defaultValue={q} placeholder="Search by name, field or topic" className="h-11 w-full rounded-full border border-line bg-surface-2 px-5 text-[15px] outline-none placeholder:text-faint focus:border-text" />
            </form>
            {discover.length ? <div className="grid gap-3 sm:grid-cols-2">{discover.map((c) => card(c))}</div> : (
              <EmptyState title={q ? `Nothing matches “${q}”` : "No other communities yet"} body="Start the one your field is missing." action={<Link href="/communities?tab=create" className="text-sm underline underline-offset-4">Create a community</Link>} />
            )}
          </>
        )}
        {tab === "create" && <Panel className="p-6"><CreateCommunity interests={profile.interests ?? []} field={profile.field} /></Panel>}
      </div>
    </>
  );
}
