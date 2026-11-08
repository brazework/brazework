import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Tabs } from "@/components/app/page-ui";
import { type Post } from "@/lib/forge";
import { projectsForPosts } from "@/lib/project-posts";
import { getViewer } from "@/lib/supabase/server";
import { Composer } from "./composer";
import { LiveRefresh } from "@/components/app/live-refresh";
import { PostCard } from "./post-card";
import { FeedRail } from "./rail";

export const metadata: Metadata = { title: "Feed" };

const TABS = [
  { id: "for-you", label: "For you" },
  { id: "latest", label: "Latest" },
  { id: "following", label: "Following" },
  { id: "communities", label: "Communities" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const POST_COLS = "id, author_id, author_first, author_last, author_headline, body, kind, tags, like_count, comment_count, created_at, community_name, project_id";

export default function FeedPage({ searchParams }: PageProps<"/feed">) {
  return (
    <div className="mx-auto grid max-w-2xl gap-8 xl:max-w-5xl xl:grid-cols-[minmax(0,1fr)_280px]">
      <LiveRefresh tables={["posts"]} />
      <div className="min-w-0">
        <Suspense fallback={<FeedSkeleton />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-label="Your clubs and upcoming events" className="hidden xl:block">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface/60" />}>
          <FeedRail />
        </Suspense>
      </aside>
    </div>
  );
}

async function Feed({ searchParams }: { searchParams: PageProps<"/feed">["searchParams"] }) {
  const sp = await searchParams;
  const tab: TabId = TABS.find((t) => t.id === sp.tab)?.id ?? "for-you";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const interests: string[] = profile.interests ?? [];

  let list: Post[] = [];
  let emptyTitle = "No posts yet";
  let emptyBody: React.ReactNode = "Be the first to share what you're building.";
  let emptyAction: React.ReactNode = null;
  const base = () => supabase.from("posts").select(POST_COLS).order("created_at", { ascending: false });

  if (tab === "for-you") {
    // Ian's rule: only posts tagged with at least one of your interests, plus your own.
    const [matching, mine] = await Promise.all([
      interests.length ? base().is("community_id", null).overlaps("tags", interests).limit(60) : Promise.resolve({ data: [] }),
      base().is("community_id", null).eq("author_id", user.id).limit(20),
    ]);
    const byId = new Map<string, Post>();
    for (const p of [...((matching.data ?? []) as Post[]), ...((mine.data ?? []) as Post[])]) byId.set(p.id, p);
    const mineSet = new Set(interests);
    list = [...byId.values()].sort((a, b) => score(b, mineSet) - score(a, mineSet));
    emptyTitle = "Nothing matching your interests yet";
    emptyBody = interests.length ? "For you only shows posts tagged with topics you follow, so it stays focused." : "For you shows posts that match your interests. Add some to get started.";
    emptyAction = <Link href="/feed?tab=latest" className="text-sm underline underline-offset-4">See all posts in Latest</Link>;
  } else if (tab === "latest") {
    list = ((await base().is("community_id", null).limit(60)).data ?? []) as Post[];
  } else if (tab === "following") {
    const [fg, cn] = await Promise.all([
      supabase.from("follows").select("target").eq("follower", user.id).limit(500),
      supabase.from("connections").select("users").contains("users", [user.id]).eq("status", "accepted").limit(500),
    ]);
    const ids = new Set<string>([...(fg.data ?? []).map((f) => f.target as string), ...(cn.data ?? []).flatMap((c) => (c.users as string[]).filter((u) => u !== user.id))]);
    list = ids.size ? (((await base().is("community_id", null).in("author_id", [...ids]).limit(50)).data ?? []) as Post[]) : [];
    emptyTitle = ids.size ? "Nothing new from people you follow" : "Your Following feed is empty";
    emptyBody = ids.size ? "The people you follow haven't posted recently." : "Follow people or connect with them, and their posts show up here.";
    emptyAction = <Link href="/network?tab=suggested" className="text-sm underline underline-offset-4">Find people</Link>;
  } else {
    const { data: joined } = await supabase.from("community_members").select("community_id").eq("uid", user.id).limit(200);
    const cids = (joined ?? []).map((j) => j.community_id as string);
    list = cids.length ? (((await base().in("community_id", cids).eq("status", "visible").limit(60)).data ?? []) as Post[]) : [];
    emptyTitle = cids.length ? "No posts in your communities yet" : "You haven't joined any communities";
    emptyBody = cids.length ? "Open one and start a conversation." : "Join communities and their latest posts show up here.";
    emptyAction = <Link href="/communities" className="text-sm underline underline-offset-4">Discover communities</Link>;
  }
  if (tag) {
    list = list.filter((p) => p.tags.includes(tag));
    emptyTitle = `No recent posts tagged ${tag}`;
    emptyBody = "Be the first.";
    emptyAction = null;
  }

  const ids = list.map((p) => p.id);
  const projects = await projectsForPosts(supabase, list);
  // For you explains itself: the first of your interests each post matches (Ian's reasonFor()).
  const mineSet = new Set(interests);
  const reasonFor = (p: Post) => {
    if (tab !== "for-you" || p.author_id === user.id) return "";
    const m = p.tags.find((t) => mineSet.has(t));
    return m ? `${p.project_id ? "Project · " : ""}Matches your interest: ${m}` : "";
  };
  const [likes, saves] = ids.length
    ? await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", ids),
        supabase.from("saved").select("post_id").eq("user_id", user.id).in("post_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l: { post_id: string }) => l.post_id));

  return (
    <>
      <FeedHeader tab={tab} />
      {interests.length > 0 && (
        <section data-tour="interests" aria-label="Your focus areas" className="mt-6 rounded-3xl border border-line bg-surface/70 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Your focus areas</h2>
            <Link href="/settings#profile" className="text-xs text-muted hover:text-text">Edit in Settings</Link>
          </div>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto sm:flex-wrap">
            {interests.map((t) => (
              <Link key={t} href={tag === t ? `/feed${tab === "for-you" ? "" : `?tab=${tab}`}` : `/feed?${tab === "for-you" ? "" : `tab=${tab}&`}tag=${encodeURIComponent(t)}`} aria-current={tag === t ? "true" : undefined} className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap transition ${tag === t ? "border-text text-text" : "border-line text-muted hover:text-text"}`}>
                #{t}
              </Link>
            ))}
          </div>
        </section>
      )}
      <div data-tour="composer" className="mt-6"><Composer first={profile.first_name} last={profile.last_name} interests={interests} /></div>
      {tag && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span>Showing posts tagged <strong className="font-medium">#{tag}</strong></span>
          <Link href={`/feed${tab === "for-you" ? "" : `?tab=${tab}`}`} className="text-muted hover:text-text">Clear</Link>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-4">
        {list.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />}
        {list.map((p, i) => <PostCard key={p.id} post={p} liked={liked.has(p.id)} saved={saved.has(p.id)} own={p.author_id === user.id} index={i} project={p.project_id ? projects[p.project_id] : null} reason={reasonFor(p)} />)}
      </div>
    </>
  );
}

function FeedHeader({ tab }: { tab?: TabId }) {
  return (
    <header data-tour="feed-tabs" className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
      <Tabs active={tab ?? ""} tabs={TABS.map((t) => ({ id: t.id, label: t.label, href: t.id === "for-you" ? "/feed" : `/feed?tab=${t.id}` }))} />
    </header>
  );
}

function FeedSkeleton() {
  return (
    <div aria-busy="true">
      <FeedHeader />
      <div className="mt-6 h-[74px] animate-pulse rounded-3xl bg-surface/60" />
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-3xl bg-surface/60" />)}
      </div>
    </div>
  );
}

function score(p: Post, interests: Set<string>) {
  const ageHours = (Date.now() - Date.parse(p.created_at)) / 36e5;
  const match = p.tags.filter((t) => interests.has(t)).length;
  return -ageHours + match * 36; // 1.5 days per matching topic, like public/js/views/feed.js
}
