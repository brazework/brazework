import type { Metadata } from "next";
import { Search, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { ConnectButtons } from "@/components/network/connect-buttons";
import { PersonRow } from "@/components/network/person-row";
import { searchForge } from "@/lib/search";
import { CommunityCard } from "../communities/community-grid";

export const metadata: Metadata = { title: "Search" };

// Full results for the search bar: up to 20 people and 20 communities, people and clubs that share
// your interests first. Connect, follow and join straight from here.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<><PageHeader title="Search" /><Skeleton className="mt-6 h-64" /></>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  if (q.length < 2) {
    return (
      <>
        <PageHeader title="Search" subtitle="Find people and communities on Forge." />
        <div className="mt-6"><EmptyState icon={<Search className="size-6" />} title="Type at least 2 letters" body="Search by name, field, headline or club. People and clubs that share your interests come first." /></div>
      </>
    );
  }
  const res = await searchForge(q, 20);
  const total = res.people.length + res.communities.length;

  return (
    <>
      <PageHeader title={`Results for “${q}”`} subtitle={total ? `${res.people.length} ${res.people.length === 1 ? "person" : "people"} · ${res.communities.length} ${res.communities.length === 1 ? "community" : "communities"}` : undefined} />
      {!total && (
        <div className="mt-6">
          <EmptyState icon={<Search className="size-6" />} title="Nothing matches that yet" body="Try a first or last name, a field like Aerospace, or part of a club's name." action={<Link href="/network?tab=suggested" className="text-sm underline underline-offset-4">See people in your fields</Link>} />
        </div>
      )}

      {res.people.length > 0 && (
        <section aria-labelledby="sr-people" className="mt-8">
          <h2 id="sr-people" className="mb-3 flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4" /> People</h2>
          <Panel className="divide-y divide-line p-0">
            {res.people.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                sub={p.shared.length ? <span className="text-accent">Shares {p.shared.slice(0, 3).join(", ")}</span> : p.field}
                actions={<ConnectButtons personId={p.id} firstName={p.firstName} relationship={p.relationship} />}
              />
            ))}
          </Panel>
        </section>
      )}

      {res.communities.length > 0 && (
        <section aria-labelledby="sr-clubs" className="mt-8">
          <h2 id="sr-clubs" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> Communities</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {res.communities.map((h) => <CommunityCard key={h.community.id} c={h.community} role={h.role ?? undefined} joinable={!h.role && !h.requested} />)}
          </div>
        </section>
      )}
    </>
  );
}
