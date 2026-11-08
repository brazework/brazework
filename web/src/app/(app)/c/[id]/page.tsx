import type { Metadata } from "next";
import { Settings } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, Panel, Skeleton, Tabs, chipCls } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { POST_COLS, PRIVACY_LABEL, TYPE_LABEL, can, membersLabel, rank, type CommunityPost } from "@/lib/communities";
import { PostCard } from "../../feed/post-card";
import { CommunityBadge, MetaLine, RoleChip } from "../../communities/_components/badge";
import { EVENT_WITH_HOST, inLog, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { EventCard } from "../../events/event-card";
import { EventEditor, EventRow } from "../../org/org-client";
import { CommunityComposer, HeldActions, JoinButton, ModRemove } from "./community-client";
import { loadCommunity } from "./data";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage({ params, searchParams }: PageProps<"/c/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <LiveRefresh tables={["posts", "community_members", "community_requests", "events"]} />
      <Suspense fallback={<><Skeleton className="h-56" /><Skeleton className="mt-6 h-72" /></>}>
        <Community params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Community({ params, searchParams }: { params: PageProps<"/c/[id]">["params"]; searchParams: PageProps<"/c/[id]">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile, community: c, me, requested } = await loadCommunity(id);
  if (!c) notFound();
  const role = me?.role ?? null;
  const isMod = can(role, "review");
  const canHost = can(role, "hostEvents");
  const tab = sp.tab === "held" && isMod ? "held" : sp.tab === "about" ? "about" : sp.tab === "events" ? "events" : "posts";

  const [visible, held] = await Promise.all([
    supabase.from("posts").select(POST_COLS).eq("community_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(60),
    isMod ? supabase.from("posts").select(POST_COLS).eq("community_id", id).eq("status", "held").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
  ]);
  const { data: evRows } = await supabase.from("events").select(EVENT_WITH_HOST).eq("community_id", id).order("starts_at", { ascending: true }).limit(100);
  const now = requestTime();
  const events = ((evRows ?? []) as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const upcomingEvents = events.filter((e) => !inLog(e, now));
  const pastEvents = events.filter((e) => inLog(e, now)).reverse();
  const evIds = upcomingEvents.map((e) => e.id);
  const [myRsvps, mySaves] = evIds.length
    ? await Promise.all([supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).in("event_id", evIds), supabase.from("event_saves").select("event_id").eq("user_id", user.id).in("event_id", evIds)])
    : [{ data: [] }, { data: [] }];
  const goingSet = new Set((myRsvps.data ?? []).map((r: { event_id: string }) => r.event_id));
  const savedSet = new Set((mySaves.data ?? []).map((r: { event_id: string }) => r.event_id));
  const posts = (visible.data ?? []) as CommunityPost[];
  const heldPosts = (held.data ?? []) as CommunityPost[];
  const ids = posts.map((p) => p.id);
  const [likes, saves] = ids.length
    ? await Promise.all([supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", ids), supabase.from("saved").select("post_id").eq("user_id", user.id).in("post_id", ids)])
    : [{ data: [] }, { data: [] }];
  const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l: { post_id: string }) => l.post_id));

  return (
    <>
      <Panel className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <CommunityBadge id={c.id} name={c.name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
              {role && role !== "member" && <RoleChip role={role} />}
            </div>
            <MetaLine parts={[membersLabel(c.member_count), PRIVACY_LABEL[c.privacy], c.field, TYPE_LABEL[c.type]]} />
          </div>
          <div className="flex items-center gap-2">
            {rank(role) >= 2 && (
              <Link href={`/c/${c.id}/manage`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm transition hover:bg-hover"><Settings className="size-4" /> Manage</Link>
            )}
            <JoinButton cid={c.id} privacy={c.privacy} state={me ? "member" : requested ? "requested" : "none"} isOwner={role === "owner"} />
          </div>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-text-2">{c.about}</p>
        {sp.created === "1" && <p className="mt-4 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">Your community is live. Invite your club: share this page&apos;s link.</p>}
      </Panel>

      <div className="mt-6">
        <Tabs active={tab} tabs={[
          { id: "posts", label: "Posts", href: `/c/${c.id}` },
          { id: "events", label: "Events", href: `/c/${c.id}?tab=events`, count: upcomingEvents.length },
          ...(isMod ? [{ id: "held", label: "Held for review", href: `/c/${c.id}?tab=held`, count: heldPosts.length }] : []),
          { id: "about", label: "About & rules", href: `/c/${c.id}?tab=about` },
        ]} />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {tab === "posts" && (
          <>
            {me ? <CommunityComposer cid={c.id} first={profile.first_name} last={profile.last_name} interests={profile.interests ?? []} topics={c.topics ?? []} /> : (
              <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">{c.privacy === "public" ? "Join to post and comment." : "Members can post here. Ask to join to take part."}</p>
            )}
            {posts.map((p, i) => (
              <div key={p.id}>
                <PostCard post={p} liked={liked.has(p.id)} saved={saved.has(p.id)} own={p.author_id === user.id} index={i} />
                {can(role, "removePosts") && p.author_id !== user.id && <ModRemove cid={c.id} postId={p.id} />}
              </div>
            ))}
            {!posts.length && <EmptyState title="No posts yet" body={me ? "Start the conversation." : "Posts from members show up here."} />}
          </>
        )}
        {tab === "held" &&
          (heldPosts.length ? heldPosts.map((p, i) => (
            <div key={p.id} className="rounded-3xl border border-dashed border-line-strong p-2">
              <PostCard post={p} liked={false} index={i} />
              <HeldActions cid={c.id} postId={p.id} />
            </div>
          )) : <EmptyState title="Nothing waiting for review" body="Posts caught by auto-moderation wait here until a moderator publishes or removes them." />)}
        {tab === "events" && (
          <>
            {canHost && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface-2 p-4">
                <p className="text-sm text-text-2">Club events show up here and in everyone&apos;s Events page{c.privacy === "approval" ? " (members only, since this club approves who joins)" : ""}.</p>
                <EventEditor communityId={c.id} />
              </div>
            )}
            {upcomingEvents.map((e) => <EventCard key={e.id} event={e} going={goingSet.has(e.id)} saved={savedSet.has(e.id)} now={now} />)}
            {!upcomingEvents.length && <EmptyState title="No upcoming events" body={canHost ? "Host a build night, demo day or info session." : "When the club's admins host something, it shows up here."} />}
            {canHost && pastEvents.length > 0 && (
              <section className="mt-4">
                <Kicker>Past events</Kicker>
                <div className="mt-3 flex flex-col gap-3">{pastEvents.map((e) => <EventRow key={e.id} event={e} editable={false} />)}</div>
              </section>
            )}
            {canHost && upcomingEvents.length > 0 && (
              <section className="mt-4">
                <Kicker>Manage upcoming</Kicker>
                <div className="mt-3 flex flex-col gap-3">{upcomingEvents.map((e) => <EventRow key={e.id} event={e} editable />)}</div>
              </section>
            )}
          </>
        )}
        {tab === "about" && (
          <Panel className="p-6">
            <Kicker>About</Kicker>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{c.about}</p>
            {(c.topics ?? []).length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{c.topics.map((t) => <span key={t} className={chipCls}>#{t}</span>)}</div>}
            <div className="mt-6"><Kicker>Rules</Kicker></div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{c.rules || "No rules posted yet. Be kind and stay on topic."}</p>
            <p className="mt-6 text-xs text-faint">Started by {c.owner_name || "a Forge member"}.</p>
          </Panel>
        )}
      </div>
    </>
  );
}
