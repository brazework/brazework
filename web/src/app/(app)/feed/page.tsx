import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { cn, type Post } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { Composer } from "./composer";
import { LiveRefresh } from "./live-refresh";
import { PostCard } from "./post-card";

export const metadata: Metadata = { title: "Feed" };

const TABS = [
  { id: "for-you", label: "For you" },
  { id: "latest", label: "Latest" },
] as const;

export default function FeedPage({ searchParams }: PageProps<"/feed">) {
  return (
    <div className="mx-auto max-w-2xl">
      <LiveRefresh />
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Feed({ searchParams }: { searchParams: PageProps<"/feed">["searchParams"] }) {
  const tab = (await searchParams).tab === "latest" ? "latest" : "for-you";
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");

  const { data: posts } = await supabase
    .from("posts")
    .select("id, author_id, author_first, author_last, author_headline, body, kind, tags, like_count, comment_count, created_at")
    .is("community_id", null)
    .order("created_at", { ascending: false })
    .limit(60);
  const list = (posts ?? []) as Post[];

  const { data: likes } = list.length
    ? await supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", list.map((p) => p.id))
    : { data: [] };
  const liked = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));

  // "For you": recency with a boost for your interests, same as the vanilla feed.
  const interests = new Set<string>(profile.interests ?? []);
  const ranked = tab === "latest" ? list : [...list].sort((a, b) => score(b, interests) - score(a, interests));

  return (
    <>
      <FeedHeader tab={tab} />
      <div className="mt-6"><Composer first={profile.first_name} last={profile.last_name} interests={profile.interests} /></div>
      <div className="mt-6 flex flex-col gap-4">
        {ranked.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line p-12 text-center text-muted">Nothing here yet. Be the first to post what you&apos;re building.</div>
        )}
        {ranked.map((p, i) => <PostCard key={p.id} post={p} liked={liked.has(p.id)} index={i} />)}
      </div>
    </>
  );
}

function FeedHeader({ tab }: { tab?: string }) {
  return (
    <header className="flex items-end justify-between">
      <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
      <nav className="glass flex rounded-full p-1 text-sm">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "latest" ? "/feed?tab=latest" : "/feed"} className={cn("rounded-full px-4 py-1.5 transition", tab === t.id ? "bg-raised text-text" : "text-muted hover:text-text")}>
            {t.label}
          </Link>
        ))}
      </nav>
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
