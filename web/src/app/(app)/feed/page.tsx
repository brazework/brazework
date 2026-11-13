import type { Metadata } from "next";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/app/page-ui";
import { menuCls } from "@/components/ui";
import { cn, requestTime, type Post } from "@/lib/forge";
import { rankForYou, scoreProof } from "@/lib/feed-rank";
import { projectsForPosts } from "@/lib/project-posts";
import { dbFeatures, postSelect } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";
import { copilotEnabled } from "@/lib/copilot";
import { loadGuide } from "@/lib/guide";
import { StartChecklist } from "./start-checklist";
import { BuildsRow, WeekLoop } from "./week-loop";
import { FirstBuild } from "./first-build";
import { cookies } from "next/headers";
import { DISMISS_PREFIX } from "@/lib/dismiss";
import { Composer } from "./composer";
import { FeedHeader, TABS, type TabId } from "./header";
import { feedTabs } from "@/lib/feed-tabs";
import { NextStep } from "./next-step";
import { WaitingOnYou } from "./waiting";
import type { ReplyPreview } from "./post-card";
import type { Proof } from "./proof-card";
import { FeedList, NewPosts, type FeedPage as FirstPage, type FeedParams, type ProofItem } from "./feed-list";
import { MessageDock } from "@/components/messages/dock";
import { FeedRail } from "./rail";
import { WeekStrip } from "./discover";
import { StripSkeleton } from "@/components/app/discover-cards";

export const metadata: Metadata = { title: "Today" };


export default function FeedPage({ searchParams }: PageProps<"/feed">) {
  return (
    <div className="feed-frame">
      <div className="min-w-0">
        <Suspense fallback={<FeedSkeleton />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-label="Your week and what's coming up" className="hidden xl:block">
        <Suspense fallback={<div className="h-96 shimmer rounded-3xl" />}>
          <FeedRail />
        </Suspense>
      </aside>
    </div>
  );
}

const KINDS = [
  { id: "", label: "All" },
  { id: "result", label: "Results" },
  { id: "question", label: "Questions" },
  { id: "project", label: "Projects" },
  { id: "update", label: "Updates" },
  { id: "video", label: "Videos" },
] as const;
const SORTS = [
  { id: "best", label: "Best" },
  { id: "new", label: "Newest" },
  { id: "old", label: "Oldest" },
] as const;
type Sort = (typeof SORTS)[number]["id"];
type Kind = (typeof KINDS)[number]["id"];
type Item = { type: "post"; post: Post; reason: string; at: number; score: number } | { type: "proof"; proof: Proof; reason: string; at: number; score: number };

async function Feed({ searchParams }: { searchParams: PageProps<"/feed">["searchParams"] }) {
  const sp = await searchParams;
  const asked: TabId | undefined = TABS.find((t) => t.id === sp.tab)?.id;
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const kind: Kind = KINDS.find((k) => k.id === sp.kind)?.id ?? "";
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const interests: string[] = profile.interests ?? [];
  const now = requestTime();
  // Started now, used at the end: none of it depends on the posts (one less round trip to wait on).
  const extrasP = Promise.all([copilotEnabled(), loadGuide()]);

  let emptyTitle = "No posts yet";
  let emptyBody: React.ReactNode = "Be the first to share what you're building.";
  let emptyAction: React.ReactNode = null;
  const { media: mediaEnabled, mentions: mentionsEnabled, milestones: proofOn, videoCaptions: captionsEnabled, chapters: chaptersOn, feedPages: pagesOn, vouches: vouchesOn } = await dbFeatures();
  const cols = await postSelect();
  const base = () => {
    let q = supabase.from("posts").select(cols).order("created_at", { ascending: sort === "old" });
    // media is JSON: .contains() would send a Postgres array literal ("{[object Object]}"), so ask for JSON containment.
    if (kind === "video") q = mediaEnabled ? q.filter("media", "cs", JSON.stringify([{ type: "video" }])) : q.eq("id", "none");
    else if (kind) q = q.eq("kind", kind);
    if (tag) q = q.contains("tags", [tag]);
    return q;
  };
  const rows = (r: { data: unknown }) => (r.data ?? []) as Post[];

  // Who and what you're connected to: your clubs, and the people you follow or are connected with.
  // (Who you follow is only needed here for the Following tab's proof, or the older path below:
  // feed_page() works out the rest in the database.)
  const needPeople = !pagesOn || asked === "following";
  const none = Promise.resolve({ data: [] as never[] });
  const [joined, fg, conn, chapterRow] = await Promise.all([
    supabase.from("community_members").select("community_id").eq("uid", user.id).limit(200),
    needPeople ? supabase.from("follows").select("target").eq("follower", user.id).limit(500) : none,
    needPeople ? supabase.from("connections").select("users").contains("users", [user.id]).eq("status", "accepted").limit(500) : none,
    // Your chapter (supabase/chapters.sql): the one you joined most recently.
    chaptersOn ? supabase.from("community_members").select("joined_at, communities!inner(id, name, network_id)").eq("uid", user.id).not("communities.network_id", "is", null).order("joined_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
  ]);
  const cids = (joined.data ?? []).map((j) => j.community_id as string);
  type ChapterRef = { id: string; name: string };
  const chapterJoin = ((chapterRow.data ?? []) as unknown as { communities: ChapterRef | ChapterRef[] | null }[])[0]?.communities;
  const chapter: ChapterRef | null = (Array.isArray(chapterJoin) ? chapterJoin[0] : chapterJoin) ?? null;
  // A chapter member's home is their chapter (Linear FIX-71): it opens on "My chapter" unless they pick
  // another tab. Everyone else opens on For you.
  const home: TabId = chapter ? "chapter" : "for-you";
  const tab: TabId = asked === "chapter" && !chapter ? "for-you" : asked ?? home;
  // For you is ranked ("Best") unless you pick a time order; the other tabs are newest first.
  const sort: Sort = SORTS.find((x) => x.id === sp.sort && (x.id !== "best" || tab === "for-you"))?.id ?? (tab === "for-you" ? "best" : "new");
  const people = [...new Set([...(fg.data ?? []).map((f) => f.target as string), ...(conn.data ?? []).flatMap((c) => (c.users as string[]).filter((u) => u !== user.id))])];

  // Proof: club-verified milestones (supabase/milestones.sql), in every tab but Latest. Milestones
  // on private projects stay out of the feed (the owner chose not to broadcast that project).
  // Fetched alongside the posts, not after them.
  type M = { id: string; title: string; detail: string; reviewed_at: string | null; community_id: string | null; community_name: string; reviewer_name: string; vouched_by?: string; owner_id: string; project: { id: string; title: string; private: boolean } | null; owner: { id: string; first_name: string; last_name: string; avatar_path?: string | null } | null };
  const proofP: Promise<M[]> = (async () => {
    if (!proofOn || tag || (kind !== "" && kind !== "result") || tab === "latest") return [];
    let q = supabase.from("milestones").select(`id, title, detail, reviewed_at, community_id, community_name, reviewer_name${vouchesOn ? ", vouched_by" : ""}, owner_id, project:projects(id, title, private), owner:profiles!milestones_owner_id_fkey(id, first_name, last_name${mediaEnabled ? ", avatar_path" : ""})`).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(12);
    if (tab === "communities") q = cids.length ? q.in("community_id", cids) : q.eq("community_id", "none");
    if (tab === "chapter") q = q.eq("community_id", chapter?.id ?? "none");
    if (tab === "following") q = people.length ? q.in("owner_id", people.slice(0, 300)) : q.eq("owner_id", user.id);
    const { data } = await q;
    return (data ?? []) as unknown as M[];
  })();

  if (tab === "for-you") {
    emptyTitle = kind || tag ? "Nothing here yet" : "Your feed is waiting for its first post";
    emptyBody = kind === "question" ? "No open questions right now. Ask one: clubs on Brazework answer fast." : "Share what you're building, or join a club to fill your feed.";
    emptyAction = <Link href="/communities?tab=discover" className="text-sm underline underline-offset-4">Find clubs to join</Link>;
  } else if (tab === "chapter" && chapter) {
    emptyTitle = kind || tag ? "Nothing here yet" : `${chapter.name} is just getting started`;
    emptyBody = "Post what you're building this week. Your chapter sees it first, and your officers can verify your milestones.";
    emptyAction = <Link href={`/c/${chapter.id}`} className="text-sm underline underline-offset-4">Open the chapter page</Link>;
  } else if (tab === "following") {
    emptyTitle = people.length || pagesOn ? "Nothing new from people you follow" : "Your Following feed is empty";
    emptyBody = people.length || pagesOn ? "Follow or connect with more people, and their posts show up here." : "Follow people or connect with them, and their posts show up here.";
    emptyAction = <Link href="/network?tab=suggested" className="text-sm underline underline-offset-4">Find people</Link>;
  } else if (tab === "communities") {
    emptyTitle = cids.length ? "No posts in your clubs yet" : "You haven't joined any clubs";
    emptyBody = cids.length ? "Open one and start a conversation." : "Join clubs and their latest posts and verified work show up here.";
    emptyAction = <Link href="/communities" className="text-sm underline underline-offset-4">Discover clubs</Link>;
  }

  // Club-verified proof, woven into the posts (For you by score; the other tabs by time).
  const mineClubs = new Set(cids);
  const proofs: ProofItem[] = (await proofP).filter((m) => m.project && !m.project.private && m.owner && m.reviewed_at).map((m) => ({
    proof: { id: m.id, title: m.title, detail: m.detail, reviewed_at: m.reviewed_at!, community_id: m.community_id, community_name: m.community_name, reviewer_name: m.reviewer_name, vouched_by: m.vouched_by, project: { id: m.project!.id, title: m.project!.title }, owner: { id: m.owner!.id, first: m.owner!.first_name, last: m.owner!.last_name, avatar: avatarSrc(m.owner) } },
    reason: tab === "for-you" ? (m.community_id && mineClubs.has(m.community_id) ? `From your club ${m.community_name}` : m.vouched_by ? "Vouched for by someone who saw it" : "Club-verified work") : "",
    at: Date.parse(m.reviewed_at!),
    score: scoreProof(m.reviewed_at!, !!m.community_id && mineClubs.has(m.community_id), now),
  })).sort((a, b) => b.score - a.score).map((p) => ({ proof: p.proof, reason: p.reason, at: p.at }));

  const viewer = { id: user.id, first: profile.first_name, last: profile.last_name };
  // Page 1: one call (supabase/feed-pages.sql). The browser asks for the next pages as you scroll.
  let first: FirstPage = { items: [], next: null, as_of: new Date(now).toISOString() };
  let params: FeedParams | null = null;
  if (pagesOn && !(tab === "chapter" && !chapter)) {
    params = {
      tab: tab === "communities" ? "clubs" : tab === "chapter" ? "community" : tab,
      sort: tab === "for-you" ? sort : sort === "old" ? "old" : "new",
      kind, tag, community: tab === "chapter" ? chapter!.id : null,
    };
    const { data } = await supabase.rpc("feed_page", { p_tab: params.tab, p_sort: params.sort, p_kind: kind, p_tag: tag, p_community: params.community, p_limit: 12 });
    if (data) first = data as FirstPage;
  } else {
    first = await legacyFirstPage();
  }

  const discover = (tab === "for-you" || tab === "latest") && !tag && !kind;
  // The create box: whether Ember is on, your next guide step, and a club you run (for its weekly update).
  const [copilotOn, guide] = await extrasP;
  const hideStart = (await cookies()).has(`${DISMISS_PREFIX}feed-start`);
  // New members get the first-five-minutes checklist; once it's done (or hidden), the weekly loop.
  const startOpen = !hideStart && (guide?.loop ?? []).some((s) => !s.done);
  const ledClub = guide?.clubs[0] ? { id: guide.clubs[0].id, name: guide.clubs[0].name } : null;
  // For the composer: "Which project?" (latest first) and the clubs it can also go to.
  const [{ data: myProjects }, { data: clubRows }] = await Promise.all([
    supabase.from("projects").select("id, title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).limit(50),
  ]);
  // No project yet: Home asks what you're building this semester (Linear FIX-71).
  const noProjects = !(myProjects ?? []).length;
  const nextStep = (guide?.loop ?? []).find((s) => !s.done)?.id;
  type ClubRef = { id: string; name: string };
  const composeClubs = ((clubRows ?? []) as unknown as { communities: ClubRef | ClubRef[] | null }[])
    .flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Before supabase/feed-pages.sql has run: the whole feed in one go, as it was (lib/db-features.ts).
  async function legacyFirstPage(): Promise<FirstPage> {
    if (!user || !profile) return { items: [], next: null, as_of: new Date(now).toISOString() };
    let items: Item[] = [];
    const asPost = (p: Post, reason = "", score = 0): Item => ({ type: "post", post: p, reason, at: Date.parse(p.created_at), score });

    if (tab === "for-you") {
      // Everything relevant to you, ranked, so it's never empty: your clubs, people you follow,
      // your interests, and what's new on Brazework (lib/feed-rank.ts).
      const [club, follow, interest, recent, mine] = await Promise.all([
        cids.length ? base().in("community_id", cids).eq("status", "visible").limit(40) : Promise.resolve({ data: [] }),
        people.length ? base().is("community_id", null).in("author_id", people.slice(0, 300)).limit(40) : Promise.resolve({ data: [] }),
        interests.length ? base().is("community_id", null).overlaps("tags", interests).limit(60) : Promise.resolve({ data: [] }),
        base().is("community_id", null).limit(40),
        base().is("community_id", null).eq("author_id", user.id).limit(10),
      ]);
      const names = new Map(rows(follow).map((p) => [p.author_id, `${p.author_first} ${p.author_last}`.trim()]));
      items = rankForYou({ club: rows(club), follow: rows(follow), interest: rows(interest), recent: rows(recent), mine: rows(mine) }, interests, names, now)
        .map((r) => asPost(r.item, r.reason, r.score));
    } else if (tab === "chapter" && chapter) {
      // Your chapter's own feed: its people and builds first, always.
      items = rows(await base().eq("community_id", chapter.id).eq("status", "visible").limit(60)).map((p) => asPost(p));
    } else if (tab === "latest") {
      items = rows(await base().is("community_id", null).limit(60)).map((p) => asPost(p));
    } else if (tab === "following") {
      items = people.length ? rows(await base().is("community_id", null).in("author_id", people.slice(0, 300)).limit(50)).map((p) => asPost(p)) : [];
    } else {
      items = cids.length ? rows(await base().in("community_id", cids).eq("status", "visible").limit(60)).map((p) => asPost(p, p.community_name ? `In ${p.community_name}` : "")) : [];
    }

    {
      const mineClubs = new Set(cids);
      const proofs: Item[] = (await proofP).filter((m) => m.project && !m.project.private && m.owner && m.reviewed_at).map((m) => ({
        type: "proof",
        proof: { id: m.id, title: m.title, detail: m.detail, reviewed_at: m.reviewed_at!, community_id: m.community_id, community_name: m.community_name, reviewer_name: m.reviewer_name, vouched_by: m.vouched_by, project: { id: m.project!.id, title: m.project!.title }, owner: { id: m.owner!.id, first: m.owner!.first_name, last: m.owner!.last_name, avatar: avatarSrc(m.owner) } },
        reason: tab === "for-you" ? (m.community_id && mineClubs.has(m.community_id) ? `From your club ${m.community_name}` : m.vouched_by ? "Vouched for by someone who saw it" : "Club-verified work") : "",
        at: Date.parse(m.reviewed_at!),
        score: scoreProof(m.reviewed_at!, !!m.community_id && mineClubs.has(m.community_id), now),
      }));
      if (proofs.length) items = [...items, ...proofs].sort((a, b) => (tab === "for-you" ? b.score - a.score : b.at - a.at));
    }
    if (sort !== "best") items.sort((a, b) => (sort === "old" ? a.at - b.at : b.at - a.at));
    if (kind === "question") items.sort((a, b) => Number(a.type === "post" && a.post.comment_count > 0) - Number(b.type === "post" && b.post.comment_count > 0));
    items = items.slice(0, 120);

    const posts = items.flatMap((it) => (it.type === "post" ? [it.post] : []));
    const ids = posts.map((p) => p.id);
    // The last round: project boxes, and which of these you've liked or saved, together.
    const [projects, likes, saves, replyRows] = await Promise.all([
      projectsForPosts(supabase, posts),
      ids.length ? supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from("saved").select("post_id").eq("user_id", user.id).in("post_id", ids) : Promise.resolve({ data: [] }),
      // The latest replies, so conversations show (and continue) right in the feed.
      ids.length ? supabase.from("comments").select("id, post_id, author_id, author_first, author_last, body, created_at").in("post_id", ids).order("created_at", { ascending: false }).limit(400) : Promise.resolve({ data: [] }),
    ]);
    const replies = new Map<string, ReplyPreview[]>();
    for (const c of (replyRows.data ?? []) as (ReplyPreview & { post_id: string })[]) {
      const list = replies.get(c.post_id) ?? [];
      if (list.length < 2) replies.set(c.post_id, [c, ...list]);
    }
    const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
    const saved = new Set((saves.data ?? []).map((l: { post_id: string }) => l.post_id));
    const own = (p: Post) => p.author_id === user!.id;
    return {
      as_of: new Date(now).toISOString(), next: null,
      items: items.flatMap((it) => (it.type === "post" ? [{ ...it.post, liked: liked.has(it.post.id), saved: saved.has(it.post.id), replies: replies.get(it.post.id) ?? [], reason: own(it.post) ? "" : it.reason, project: it.post.project_id ? projects[it.post.project_id] ?? null : null }] : [])),
    };
  }

  // What the Filter button says: "Filter", or what's narrowing the feed right now.
  const sorted = sort !== (tab === "for-you" ? "best" : "new");
  const filterLabel = tag ? `#${tag}` : kind ? KINDS.find((k) => k.id === kind)?.label ?? "Filter" : sorted ? SORTS.find((x) => x.id === sort)?.label ?? "Filter" : "Filter";
  const href = (patch: { tab?: string; kind?: string; tag?: string; sort?: string }) => {
    const q = new URLSearchParams();
    const t = patch.tab ?? tab, k = patch.kind ?? kind, g = patch.tag ?? tag;
    const o = patch.sort ?? (patch.tab && patch.tab !== tab ? "" : sort);
    if (t !== home) q.set("tab", t);
    if (k) q.set("kind", k);
    if (g) q.set("tag", g);
    if (o && o !== (t === "for-you" ? "best" : "new")) q.set("sort", o);
    const s = q.toString();
    return `/feed${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <NewPosts me={user.id} />
      <MessageDock />
      <FeedHeader tabs={feedTabs(tab, Boolean(chapter))} hrefFor={(t) => href({ tab: t })}
        filter={/* One Filter menu for the feed: order, kind of post and your topics (they were a sort pill, a kind row and a topics chip). */
          <details name="feed-menu" key={`${tab}:${kind}:${tag}:${sort}`} data-tour="interests" className="group relative shrink-0">
            <summary aria-label={filterLabel === "Filter" ? "Filter the feed" : `Filter: ${filterLabel}`} className={cn("flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition [&::-webkit-details-marker]:hidden", filterLabel === "Filter" ? "border-line bg-surface text-text-2 hover:border-line-strong hover:text-text" : "bg-accent-grad border-transparent text-on-accent")}>
              <SlidersHorizontal className="size-3.5" /><span className="hidden max-w-28 truncate sm:inline">{filterLabel}</span>
              <ChevronDown className="hidden size-3 transition group-open:rotate-180 sm:block" />
            </summary>
            <div className={cn(menuCls, "absolute top-full right-0 z-30 mt-1.5 w-72 p-2")}>
              <div className="px-1 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">Order</div>
              <div className="flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5" role="group" aria-label="Sort posts">
                {SORTS.filter((x) => x.id !== "best" || tab === "for-you").map((x) => (
                  <Link key={x.id} href={href({ sort: x.id })} aria-current={sort === x.id ? "true" : undefined} className={cn("flex-1 rounded-full px-2.5 py-1 text-center text-xs whitespace-nowrap transition", sort === x.id ? "bg-text text-surface" : "text-muted hover:text-text")}>{x.label}</Link>
                ))}
              </div>
              <div className="px-1 pt-3 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">Show</div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kind of post">
                {KINDS.map((k) => (
                  <Link key={k.id || "all"} href={href({ kind: k.id })} aria-current={kind === k.id ? "true" : undefined}
                    className={cn("rounded-full border px-2.5 py-1 text-xs transition", kind === k.id ? "border-transparent bg-text text-surface" : "border-line text-muted hover:border-line-strong hover:text-text")}>
                    {k.label}
                  </Link>
                ))}
              </div>
              {interests.length > 0 && <>
                <div className="px-1 pt-3 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">Your topics</div>
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((t) => (
                    <Link key={t} href={href({ tag: tag === t ? "" : t })} aria-current={tag === t ? "true" : undefined}
                      className={cn("rounded-full border px-2.5 py-1 text-xs transition", tag === t ? "bg-accent-grad border-transparent text-on-accent" : "border-line text-muted hover:border-line-strong hover:text-text")}>
                      #{t}
                    </Link>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-2 text-xs">
                  {tag ? <Link href={href({ tag: "" })} className="text-muted hover:text-text">All topics</Link> : <span className="text-faint">From your interests</span>}
                  <Link href="/settings#profile" className="text-muted hover:text-text">Edit</Link>
                </div>
              </>}
            </div>
          </details>}
        hero={<>
          {/* What's yours, in order: your next step, the log-work box, what's waiting on you, your builds. */}
          {noProjects && <FirstBuild first={profile.first_name} chapter={chapter?.name} />}
          {/* When the checklist's next step is the project, the card above already asks it, so the checklist waits. */}
          {startOpen && !(noProjects && nextStep === "project") ? <StartChecklist steps={guide?.loop ?? []} /> : noProjects ? null : <><Suspense fallback={<div className="h-[76px] shimmer rounded-2xl" aria-hidden="true" />}><NextStep /></Suspense><Suspense fallback={null}><WeekLoop /></Suspense></>}
          <div id="composer" data-tour="composer" className="scroll-mt-24"><Composer first={profile.first_name} last={profile.last_name} interests={interests} userId={user.id} mediaEnabled={mediaEnabled} captionsEnabled={captionsEnabled} avatarSrc={avatarSrc(profile)} copilot={copilotOn} mentionsEnabled={mentionsEnabled} club={ledClub} next={null} projects={(myProjects ?? []) as { id: string; title: string }[]} clubs={composeClubs} defaultShareTo={chapter?.id} initialProject={typeof sp.project === "string" ? sp.project : undefined} /></div>
          <Suspense fallback={null}><WaitingOnYou /></Suspense>
          {!startOpen && !noProjects && <Suspense fallback={null}><BuildsRow /></Suspense>}
        </>} />
      {(tag || kind) && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span>Showing {kind ? <strong className="font-medium">{KINDS.find((k) => k.id === kind)?.label.toLowerCase()}</strong> : "posts"}{tag && <> tagged <strong className="font-medium">#{tag}</strong></>}{kind === "question" && " · unanswered first"}{sort === "old" && " · oldest first"}</span>
          <Link href={href({ kind: "", tag: "", sort: "" })} className="text-muted hover:text-text">Clear</Link>
        </div>
      )}
      {discover && <div className="mt-6"><Suspense fallback={<StripSkeleton w={250} h={96} />}><WeekStrip /></Suspense></div>}
      <div className="mt-6 flex flex-col gap-4">
        {first.items.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />}
        <FeedList first={first} params={params} proofs={proofs} ranked={tab === "for-you" && sort === "best"} me={user.id} viewer={viewer} slots={{}}
          end={first.items.length > 0 ? <FeedEnd tab={tab} /> : null} />
      </div>
    </>
  );
}

// The bottom of the feed: somewhere useful to go next.
function FeedEnd({ tab }: { tab: TabId }) {
  return (
    <div className="glass-card mt-2 rounded-3xl p-6 text-center">
      <p className="font-medium">You&apos;re all caught up</p>
      <p className="mt-1 text-sm text-muted">Keep the momentum: help someone, or show what you built.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/feed?kind=question" className="rounded-full border border-line px-3.5 py-1.5 text-sm transition hover:border-line-strong">Answer a question</Link>
        <Link href="/feed#composer" className="rounded-full border border-line px-3.5 py-1.5 text-sm transition hover:border-line-strong">Post your progress</Link>
        {tab !== "latest" && <Link href="/feed?tab=latest" className="rounded-full border border-line px-3.5 py-1.5 text-sm transition hover:border-line-strong">Everything on Brazework</Link>}
      </div>
    </div>
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
