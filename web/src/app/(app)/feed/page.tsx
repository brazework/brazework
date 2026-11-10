import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/app/page-ui";
import { cn, requestTime, type Post } from "@/lib/forge";
import { rankForYou, scoreProof } from "@/lib/feed-rank";
import { projectsForPosts } from "@/lib/project-posts";
import { dbFeatures, postSelect } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";
import { copilotEnabled } from "@/lib/copilot";
import { loadGuide } from "@/lib/guide";
import { StartChecklist } from "./start-checklist";
import { Composer } from "./composer";
import { FeedHeader, TABS, type TabId } from "./header";
import { PostCard, type ReplyPreview } from "./post-card";
import { ProofCard, type Proof } from "./proof-card";
import { FeedList, NewPosts } from "./feed-list";
import { MessageDock } from "@/components/messages/dock";
import { FeedRail } from "./rail";
import { PeopleStrip, SpotlightStrip, WeekStrip } from "./discover";
import { StripSkeleton } from "@/components/app/discover-cards";

export const metadata: Metadata = { title: "Feed" };


export default function FeedPage({ searchParams }: PageProps<"/feed">) {
  return (
    <div className="feed-frame">
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
  const tab: TabId = TABS.find((t) => t.id === sp.tab)?.id ?? "for-you";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const kind: Kind = KINDS.find((k) => k.id === sp.kind)?.id ?? "";
  // For you is ranked ("Best") unless you pick a time order; the other tabs are newest first.
  const sort: Sort = SORTS.find((x) => x.id === sp.sort && (x.id !== "best" || tab === "for-you"))?.id ?? (tab === "for-you" ? "best" : "new");
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const interests: string[] = profile.interests ?? [];
  const now = requestTime();
  // Started now, used at the end: none of it depends on the posts (one less round trip to wait on).
  const extrasP = Promise.all([copilotEnabled(), loadGuide()]);

  let emptyTitle = "No posts yet";
  let emptyBody: React.ReactNode = "Be the first to share what you're building.";
  let emptyAction: React.ReactNode = null;
  const { media: mediaEnabled, mentions: mentionsEnabled, milestones: proofOn } = await dbFeatures();
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
  const [joined, fg, conn] = await Promise.all([
    supabase.from("community_members").select("community_id").eq("uid", user.id).limit(200),
    supabase.from("follows").select("target").eq("follower", user.id).limit(500),
    supabase.from("connections").select("users").contains("users", [user.id]).eq("status", "accepted").limit(500),
  ]);
  const cids = (joined.data ?? []).map((j) => j.community_id as string);
  const people = [...new Set([...(fg.data ?? []).map((f) => f.target as string), ...(conn.data ?? []).flatMap((c) => (c.users as string[]).filter((u) => u !== user.id))])];

  // Proof: club-verified milestones (supabase/milestones.sql), in every tab but Latest. Milestones
  // on private projects stay out of the feed (the owner chose not to broadcast that project).
  // Fetched alongside the posts, not after them.
  type M = { id: string; title: string; detail: string; reviewed_at: string | null; community_id: string; community_name: string; reviewer_name: string; owner_id: string; project: { id: string; title: string; private: boolean } | null; owner: { id: string; first_name: string; last_name: string; avatar_path?: string | null } | null };
  const proofP: Promise<M[]> = (async () => {
    if (!proofOn || tag || (kind !== "" && kind !== "result") || tab === "latest") return [];
    let q = supabase.from("milestones").select(`id, title, detail, reviewed_at, community_id, community_name, reviewer_name, owner_id, project:projects(id, title, private), owner:profiles!milestones_owner_id_fkey(id, first_name, last_name${mediaEnabled ? ", avatar_path" : ""})`).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(12);
    if (tab === "communities") q = cids.length ? q.in("community_id", cids) : q.eq("community_id", "none");
    if (tab === "following") q = people.length ? q.in("owner_id", people.slice(0, 300)) : q.eq("owner_id", user.id);
    const { data } = await q;
    return (data ?? []) as unknown as M[];
  })();

  let items: Item[] = [];
  const asPost = (p: Post, reason = "", score = 0): Item => ({ type: "post", post: p, reason, at: Date.parse(p.created_at), score });

  if (tab === "for-you") {
    // Everything relevant to you, ranked, so it's never empty: your clubs, people you follow,
    // your interests, and what's new on Forge (lib/feed-rank.ts).
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
    emptyTitle = kind || tag ? "Nothing here yet" : "Your feed is waiting for its first post";
    emptyBody = kind === "question" ? "No open questions right now. Ask one: clubs on Forge answer fast." : "Share what you're building, or join a club to fill your feed.";
    emptyAction = <Link href="/communities?tab=discover" className="text-sm underline underline-offset-4">Find clubs to join</Link>;
  } else if (tab === "latest") {
    items = rows(await base().is("community_id", null).limit(60)).map((p) => asPost(p));
  } else if (tab === "following") {
    items = people.length ? rows(await base().is("community_id", null).in("author_id", people.slice(0, 300)).limit(50)).map((p) => asPost(p)) : [];
    emptyTitle = people.length ? "Nothing new from people you follow" : "Your Following feed is empty";
    emptyBody = people.length ? "The people you follow haven't posted recently." : "Follow people or connect with them, and their posts show up here.";
    emptyAction = <Link href="/network?tab=suggested" className="text-sm underline underline-offset-4">Find people</Link>;
  } else {
    items = cids.length ? rows(await base().in("community_id", cids).eq("status", "visible").limit(60)).map((p) => asPost(p, p.community_name ? `In ${p.community_name}` : "")) : [];
    emptyTitle = cids.length ? "No posts in your clubs yet" : "You haven't joined any clubs";
    emptyBody = cids.length ? "Open one and start a conversation." : "Join clubs and their latest posts and verified work show up here.";
    emptyAction = <Link href="/communities" className="text-sm underline underline-offset-4">Discover clubs</Link>;
  }

  {
    const mineClubs = new Set(cids);
    const proofs: Item[] = (await proofP).filter((m) => m.project && !m.project.private && m.owner && m.reviewed_at).map((m) => ({
      type: "proof",
      proof: { id: m.id, title: m.title, detail: m.detail, reviewed_at: m.reviewed_at!, community_id: m.community_id, community_name: m.community_name, reviewer_name: m.reviewer_name, project: { id: m.project!.id, title: m.project!.title }, owner: { id: m.owner!.id, first: m.owner!.first_name, last: m.owner!.last_name, avatar: avatarSrc(m.owner) } },
      reason: tab === "for-you" ? (mineClubs.has(m.community_id) ? `From your club ${m.community_name}` : "Club-verified work") : "",
      at: Date.parse(m.reviewed_at!),
      score: scoreProof(m.reviewed_at!, mineClubs.has(m.community_id), now),
    }));
    if (proofs.length) items = [...items, ...proofs].sort((a, b) => (tab === "for-you" ? b.score - a.score : b.at - a.at));
  }
  if (sort !== "best") items.sort((a, b) => (sort === "old" ? a.at - b.at : b.at - a.at));
  if (kind === "question") items.sort((a, b) => Number(a.type === "post" && a.post.comment_count > 0) - Number(b.type === "post" && b.post.comment_count > 0));
  items = items.slice(0, 120);

  const posts = items.flatMap((it) => (it.type === "post" ? [it.post] : []));
  const ids = posts.map((p) => p.id);
  const discover = (tab === "for-you" || tab === "latest") && !tag && !kind;
  // The create box: whether Ember is on, your next guide step, and a club you run (for its weekly update).
  const [copilotOn, guide] = await extrasP;
  const nextStep = guide?.member.find((s) => !s.done) ?? null;
  const ledClub = guide?.clubs[0] ? { id: guide.clubs[0].id, name: guide.clubs[0].name } : null;
  // For the composer: "Which project?" (latest first) and the clubs it can also go to.
  const [{ data: myProjects }, { data: clubRows }] = await Promise.all([
    supabase.from("projects").select("id, title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("community_members").select("communities(id, name)").eq("uid", user.id).limit(50),
  ]);
  type ClubRef = { id: string; name: string };
  const composeClubs = ((clubRows ?? []) as unknown as { communities: ClubRef | ClubRef[] | null }[])
    .flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
  const spotlight = <div className="py-2 empty:hidden"><Suspense fallback={<StripSkeleton w={280} h={250} />}><SpotlightStrip /></Suspense></div>;
  const peopleStrip = <div className="py-2 empty:hidden"><Suspense fallback={<StripSkeleton w={200} h={250} />}><PeopleStrip field={profile.field} interests={interests} rows /></Suspense></div>;
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
  const viewer = { id: user.id, first: profile.first_name, last: profile.last_name };
  const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l: { post_id: string }) => l.post_id));
  const href = (patch: { tab?: string; kind?: string; tag?: string; sort?: string }) => {
    const q = new URLSearchParams();
    const t = patch.tab ?? tab, k = patch.kind ?? kind, g = patch.tag ?? tag;
    const o = patch.sort ?? (patch.tab && patch.tab !== tab ? "" : sort);
    if (t !== "for-you") q.set("tab", t);
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
      <FeedHeader tab={tab} hrefFor={(t) => href({ tab: t })} sort={/* Order: ranked, newest or oldest first. */ <span className="mr-1 hidden shrink-0 sm:inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Sort posts">
          {SORTS.filter((x) => x.id !== "best" || tab === "for-you").map((x) => (
            <Link key={x.id} href={href({ sort: x.id })} aria-current={sort === x.id ? "true" : undefined} className={cn("rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap transition", sort === x.id ? "bg-text text-surface" : "text-muted hover:text-text")}>{x.label}</Link>
          ))}
        </span>} hero={<div id="composer" data-tour="composer" className="scroll-mt-24"><StartChecklist steps={guide?.loop ?? []} /><Composer first={profile.first_name} last={profile.last_name} interests={interests} userId={user.id} mediaEnabled={mediaEnabled} avatarSrc={avatarSrc(profile)} copilot={copilotOn} mentionsEnabled={mentionsEnabled} club={ledClub} next={nextStep && (guide?.loop ?? []).every((x) => x.done) ? { label: nextStep.label, href: nextStep.href } : null} projects={(myProjects ?? []) as { id: string; title: string }[]} clubs={composeClubs} initialProject={typeof sp.project === "string" ? sp.project : undefined} /></div>} />
      {/* What kind of post, then your topics: one row, so filtering is one tap from anywhere in the feed. */}
      <nav data-tour="interests" aria-label="Filter the feed" className="no-scrollbar -mx-1 mt-4 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
        {KINDS.map((k) => (
          <Link key={k.id || "all"} href={href({ kind: k.id })} aria-current={kind === k.id ? "true" : undefined} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition active:scale-95", kind === k.id ? "border-text bg-text text-surface" : "border-line bg-surface text-text-2 hover:border-line-strong hover:text-text")}>
            {k.label}
          </Link>
        ))}
        {interests.length > 0 && <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line" />}
        {interests.map((t) => (
          <Link key={t} href={href({ tag: tag === t ? "" : t })} aria-current={tag === t ? "true" : undefined} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition active:scale-95", tag === t ? "bg-accent-grad border-transparent text-on-accent shadow-[0_6px_18px_-8px_var(--accent)]" : "border-line bg-surface text-muted hover:border-line-strong hover:text-text")}>
            #{t}
          </Link>
        ))}
        {interests.length > 0 && <Link href="/settings#profile" className="shrink-0 rounded-full px-2 py-1 text-xs text-faint hover:text-text">Edit</Link>}
        {/* Phones: sort lives at the end of this row (the tabs row is too narrow there). */}
        <span className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 sm:hidden" role="group" aria-label="Sort posts">
          {SORTS.filter((x) => x.id !== "best" || tab === "for-you").map((x) => (
            <Link key={x.id} href={href({ sort: x.id })} aria-current={sort === x.id ? "true" : undefined} className={cn("rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap transition", sort === x.id ? "bg-text text-surface" : "text-muted hover:text-text")}>{x.label}</Link>
          ))}
        </span>
      </nav>
      {(tag || kind) && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span>Showing {kind ? <strong className="font-medium">{KINDS.find((k) => k.id === kind)?.label.toLowerCase()}</strong> : "posts"}{tag && <> tagged <strong className="font-medium">#{tag}</strong></>}{kind === "question" && " · unanswered first"}{sort === "old" && " · oldest first"}</span>
          <Link href={href({ kind: "", tag: "", sort: "" })} className="text-muted hover:text-text">Clear</Link>
        </div>
      )}
      {discover && <div className="mt-6"><Suspense fallback={<StripSkeleton w={250} h={96} />}><WeekStrip /></Suspense></div>}
      <div className="mt-6 flex flex-col gap-4">
        {items.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />}
        <FeedList
          items={items.map((it, i) => ({
            key: `${it.type}:${it.type === "post" ? it.post.id : it.proof.id}`,
            node: it.type === "post"
              ? <PostCard post={it.post} liked={liked.has(it.post.id)} saved={saved.has(it.post.id)} own={it.post.author_id === user.id} index={i} project={it.post.project_id ? projects[it.post.project_id] : null} reason={it.post.author_id === user.id ? "" : it.reason} replies={replies.get(it.post.id)} viewer={viewer} />
              : <ProofCard p={it.proof} reason={it.reason} />,
          }))}
          slots={discover ? { 1: spotlight, 4: peopleStrip } : {}}
          end={items.length > 0 ? <FeedEnd tab={tab} /> : null}
        />
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
        {tab !== "latest" && <Link href="/feed?tab=latest" className="rounded-full border border-line px-3.5 py-1.5 text-sm transition hover:border-line-strong">Everything on Forge</Link>}
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
