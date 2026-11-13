import type { Metadata } from "next";
import { CalendarDays, FolderGit2, Hash, MessageSquare, Search, Sparkles, Users, UserRound } from "lucide-react";
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
    <div className="mx-auto max-w-4xl 2xl:max-w-6xl">
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
        <PageHeader title="Search" subtitle="Find people and communities on Brazework." />
        <div className="mt-6"><EmptyState icon={<Search className="size-6" />} title="Type at least 2 letters" body="Search by name, field, headline or club. People and clubs that share your interests come first." /></div>
      </>
    );
  }
  const res = await searchForge(q, 20);
  const total = res.people.length + res.communities.length + res.projects.length + res.events.length + res.posts.length;
  const row = "flex items-center gap-3 px-5 py-3.5 transition hover:bg-hover";

  return (
    <>
      <PageHeader title={`Results for “${q}”`} subtitle={total ? [`${res.people.length} ${res.people.length === 1 ? "person" : "people"}`, `${res.communities.length} ${res.communities.length === 1 ? "community" : "communities"}`, `${res.projects.length} ${res.projects.length === 1 ? "project" : "projects"}`, `${res.events.length} ${res.events.length === 1 ? "event" : "events"}`, `${res.posts.length} ${res.posts.length === 1 ? "post" : "posts"}`].join(" · ") : undefined} />
      <Link href={`/copilot?q=${encodeURIComponent(q)}`} className={`grad-edge mt-6 flex items-center gap-3 rounded-3xl border p-4 shadow-[var(--shadow)] transition ${res.question ? "" : "opacity-90"}`}>
        <span className="bg-accent-grad grid size-10 shrink-0 place-items-center rounded-xl text-on-accent"><Sparkles className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-medium">{res.question ? "This looks like a question. Ask Ember" : "Ask Ember about this"}</span><span className="block truncate text-sm text-muted">&ldquo;{q}&rdquo;: answers with clubs, events and people from Brazework</span></span>
      </Link>
      {res.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted">Topics:</span>
          {res.topics.map((t) => <Link key={t} href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs text-text-2 transition hover:bg-hover"><Hash className="size-3" /> {t}</Link>)}
        </div>
      )}
      {!total && (
        <div className="mt-6">
          <EmptyState icon={<Search className="size-6" />} title="Nothing matches that yet" body="Try a name, a field like Aerospace, a topic like robotics, or part of a club's or project's name." action={<Link href="/network?tab=suggested" className="text-sm underline underline-offset-4">See people in your fields</Link>} />
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

      {res.projects.length > 0 && (
        <section aria-labelledby="sr-projects" className="mt-8">
          <h2 id="sr-projects" className="mb-3 flex items-center gap-2 text-sm font-semibold"><FolderGit2 className="size-4" /> Projects</h2>
          <Panel className="divide-y divide-line p-0">
            {res.projects.map((x) => (
              <Link key={x.id} href={`/u/${x.ownerId}#projects`} className={row}>
                <span className="min-w-0 flex-1"><span className="block font-medium">{x.title}</span><span className="block truncate text-sm text-muted">{x.summary}</span><span className="block text-xs text-faint">{x.owner}{x.tags.length ? ` · ${x.tags.map((t) => `#${t}`).join(" ")}` : ""}</span></span>
              </Link>
            ))}
          </Panel>
        </section>
      )}

      {res.events.length > 0 && (
        <section aria-labelledby="sr-events" className="mt-8">
          <h2 id="sr-events" className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4" /> Events</h2>
          <Panel className="divide-y divide-line p-0">
            {res.events.map((x) => (
              <Link key={x.id} href={`/events/${x.id}`} className={row}>
                <span className="min-w-0 flex-1"><span className="block font-medium">{x.title}</span><span className="block text-xs text-faint">{new Date(x.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · {x.type} · {x.format}</span></span>
              </Link>
            ))}
          </Panel>
        </section>
      )}

      {res.posts.length > 0 && (
        <section aria-labelledby="sr-posts" className="mt-8">
          <h2 id="sr-posts" className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4" /> Posts</h2>
          <Panel className="divide-y divide-line p-0">
            {res.posts.map((x) => (
              <Link key={x.id} href={`/post/${x.id}`} className={row}>
                <span className="min-w-0 flex-1"><span className="block text-sm text-text-2">{x.body}</span><span className="block text-xs text-faint">{x.author} · {x.kind}</span></span>
              </Link>
            ))}
          </Panel>
        </section>
      )}

      {res.communities.length > 0 && (
        <section aria-labelledby="sr-clubs" className="mt-8">
          <h2 id="sr-clubs" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> Communities</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {res.communities.map((h) => <CommunityCard key={h.community.id} c={h.community} role={h.role ?? undefined} joinable={!h.role && !h.requested} />)}
          </div>
        </section>
      )}
    </>
  );
}
