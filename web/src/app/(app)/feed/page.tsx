import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment, Suspense } from "react";
import { EmptyState } from "@/components/app/page-ui";
import { type Post } from "@/lib/forge";
import { projectsForPosts } from "@/lib/project-posts";
import { dbFeatures, postSelect } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";
import { copilotEnabled } from "@/lib/copilot";
import { loadGuide } from "@/lib/guide";
import { Composer } from "./composer";
import { LiveRefresh } from "@/components/app/live-refresh";
import { FeedHeader, TABS, type TabId } from "./header";
import { PostCard } from "./post-card";
import { FeedRail } from "./rail";
import { PeopleStrip, SpotlightStrip, WeekStrip } from "./discover";
import { StripSkeleton } from "@/components/app/discover-cards";

export const metadata: Metadata = { title: "Feed" };


export default function FeedPage({ searchParams }: PageProps<"/feed">) {
  return (
    <div className="mx-auto grid max-w-2xl gap-8 xl:max-w-6xl xl:grid-cols-[minmax(0,1fr)_300px] 2xl:max-w-7xl 2xl:grid-cols-[minmax(0,1fr)_340px] min-[112.5rem]:max-w-[1520px] min-[112.5rem]:grid-cols-[minmax(0,1fr)_380px] min-[137.5rem]:max-w-[1840px] min-[137.5rem]:grid-cols-[minmax(0,1fr)_740px]">
      <LiveRefresh tables={["posts"]} />
      <div className="min-w-0">
        <Suspense fallback={<FeedSkeleton />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-label="Forge updates, your clubs and upcoming events" className="hidden xl:block">
        <Suspense fallback={<div className="h-96 shimmer rounded-3xl" />}>
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
  const { media: mediaEnabled } = await dbFeatures();
  const cols = await postSelect();
  const base = () => supabase.from("posts").select(cols).order("created_at", { ascending: false });

  if (tab === "for-you") {
    // Ian's rule: only posts tagged with at least one of your interests, plus your own.
    const [matching, mine] = await Promise.all([
      interests.length ? base().is("community_id", null).overlaps("tags", interests).limit(60) : Promise.resolve({ data: [] }),
      base().is("community_id", null).eq("author_id", user.id).limit(20),
    ]);
    const byId = new Map<string, Post>();
    for (const p of [...((matching.data ?? []) as unknown as Post[]), ...((mine.data ?? []) as unknown as Post[])]) byId.set(p.id, p);
    const mineSet = new Set(interests);
    list = [...byId.values()].sort((a, b) => score(b, mineSet) - score(a, mineSet));
    emptyTitle = "Nothing matching your interests yet";
    emptyBody = interests.length ? "For you only shows posts tagged with topics you follow, so it stays focused." : "For you shows posts that match your interests. Add some to get started.";
    emptyAction = <Link href="/feed?tab=latest" className="text-sm underline underline-offset-4">See all posts in Latest</Link>;
  } else if (tab === "latest") {
    list = ((await base().is("community_id", null).limit(60)).data ?? []) as unknown as Post[];
  } else if (tab === "following") {
    const [fg, cn] = await Promise.all([
      supabase.from("follows").select("target").eq("follower", user.id).limit(500),
      supabase.from("connections").select("users").contains("users", [user.id]).eq("status", "accepted").limit(500),
    ]);
    const ids = new Set<string>([...(fg.data ?? []).map((f) => f.target as string), ...(cn.data ?? []).flatMap((c) => (c.users as string[]).filter((u) => u !== user.id))]);
    list = ids.size ? (((await base().is("community_id", null).in("author_id", [...ids]).limit(50)).data ?? []) as unknown as Post[]) : [];
    emptyTitle = ids.size ? "Nothing new from people you follow" : "Your Following feed is empty";
    emptyBody = ids.size ? "The people you follow haven't posted recently." : "Follow people or connect with them, and their posts show up here.";
    emptyAction = <Link href="/network?tab=suggested" className="text-sm underline underline-offset-4">Find people</Link>;
  } else {
    const { data: joined } = await supabase.from("community_members").select("community_id").eq("uid", user.id).limit(200);
    const cids = (joined ?? []).map((j) => j.community_id as string);
    list = cids.length ? (((await base().in("community_id", cids).eq("status", "visible").limit(60)).data ?? []) as unknown as Post[]) : [];
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
  const discover = (tab === "for-you" || tab === "latest") && !tag;
  // The create box: whether Ember is on, your next guide step, and a club you run (for its weekly update).
  const [copilotOn, guide] = await Promise.all([copilotEnabled(), loadGuide()]);
  const nextStep = guide?.member.find((s) => !s.done) ?? null;
  const ledClub = guide?.clubs[0] ? { id: guide.clubs[0].id, name: guide.clubs[0].name } : null;
  const spotlight = <div className="py-2"><Suspense fallback={<StripSkeleton w={280} h={250} />}><SpotlightStrip /></Suspense></div>;
  const people = <div className="py-2"><Suspense fallback={<StripSkeleton w={200} h={250} />}><PeopleStrip field={profile.field} interests={interests} /></Suspense></div>;
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
      <FeedHeader tab={tab} hero={<div id="composer" data-tour="composer" className="scroll-mt-24"><Composer first={profile.first_name} last={profile.last_name} interests={interests} userId={user.id} mediaEnabled={mediaEnabled} avatarSrc={avatarSrc(profile)} copilot={copilotOn} club={ledClub} next={nextStep ? { label: nextStep.label, href: nextStep.href } : null} /></div>} />
      {interests.length > 0 && (
        <section data-tour="interests" aria-label="Your focus areas" className="mt-5">
          <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
            {interests.map((t) => (
              <Link key={t} href={tag === t ? `/feed${tab === "for-you" ? "" : `?tab=${tab}`}` : `/feed?${tab === "for-you" ? "" : `tab=${tab}&`}tag=${encodeURIComponent(t)}`} aria-current={tag === t ? "true" : undefined} className={`shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition active:scale-95 ${tag === t ? "bg-accent-grad border-transparent text-on-accent shadow-[0_6px_18px_-8px_var(--accent)]" : "border-line bg-surface text-muted hover:border-line-strong hover:text-text"}`}>
                #{t}
              </Link>
            ))}
            <Link href="/settings#profile" className="shrink-0 rounded-full px-2 py-1 text-xs text-faint hover:text-text">Edit</Link>
          </div>
        </section>
      )}
      {tag && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span>Showing posts tagged <strong className="font-medium">#{tag}</strong></span>
          <Link href={`/feed${tab === "for-you" ? "" : `?tab=${tab}`}`} className="text-muted hover:text-text">Clear</Link>
        </div>
      )}
      {discover && !tag && <div className="mt-6"><Suspense fallback={<StripSkeleton w={250} h={96} />}><WeekStrip /></Suspense></div>}
      <div className="mt-6 flex flex-col gap-4">
        {list.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />}
        {list.map((p, i) => (
          <Fragment key={p.id}>
            <PostCard post={p} liked={liked.has(p.id)} saved={saved.has(p.id)} own={p.author_id === user.id} index={i} project={p.project_id ? projects[p.project_id] : null} reason={reasonFor(p)} />
            {/* Discovery strips sit between posts; with only a few posts they follow the last one. */}
            {discover && (i === 1 || (i === list.length - 1 && list.length < 2)) && spotlight}
            {discover && (i === 4 || (i === list.length - 1 && list.length < 5)) && people}
          </Fragment>
        ))}
        {discover && list.length === 0 && <>{spotlight}{people}</>}
      </div>
    </>
  );
}

function FeedSkeleton() {
  return (
    <div aria-busy="true">
      <FeedHeader />
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-48 shimmer rounded-3xl" />)}
      </div>
    </div>
  );
}

function score(p: Post, interests: Set<string>) {
  const ageHours = (Date.now() - Date.parse(p.created_at)) / 36e5;
  const match = p.tags.filter((t) => interests.has(t)).length;
  return -ageHours + match * 36; // 1.5 days per matching topic, like public/js/views/feed.js
}
