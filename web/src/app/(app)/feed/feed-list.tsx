"use client";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { useWindowVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Post, PostProject } from "@/lib/forge";
import { getBrowserClient } from "@/lib/supabase/client";
import { PostCard, type ReplyPreview } from "./post-card";
import { ProofCard, type Proof } from "./proof-card";

// One post card as supabase/feed-pages.sql's feed_page() returns it: the post plus everything the
// card shows, so a page is one request.
export type Card = Post & { liked: boolean; saved: boolean; replies: ReplyPreview[]; reason: string; project: PostProject | null };
export type FeedPage = { items: Card[]; next: unknown; as_of: string };
export type FeedParams = { tab: string; sort: string; kind: string; tag: string; community: string | null };
export type ProofItem = { proof: Proof; reason: string; at: number };

const PAGE = 12;
// Saved per feed while you're away (open a post, come back): the cards' measured heights, so the list
// is the right length at once and the browser puts you back where you were.
const remembered = new Map<string, VirtualItem[]>();

// The feed: endless (the next page loads while you're still two screens from the end, so you never
// wait at a spinner), light (only the cards near the screen are in the page, however far you scroll),
// and cached (back to Home reuses what you scrolled). Page 1 arrives with the page; the rest come from
// the browser straight to feed_page(), one request each. `params` null: the database doesn't have
// feed_page() yet, so this is the whole feed (the app adapts to the database, lib/db-features.ts).
export function FeedList({ first, params, proofs, ranked, slots, end, me, viewer }: {
  first: FeedPage; params: FeedParams | null; proofs: ProofItem[]; ranked: boolean;
  slots: Record<number, ReactNode>; end: ReactNode; me: string; viewer: { id: string; first: string; last: string };
}) {
  const key = ["feed", params, first.as_of] as const;
  const q = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage>, typeof key, unknown>({
    queryKey: key,
    initialPageParam: null,
    initialData: { pages: [first], pageParams: [null] },
    // Anchored to the first page's moment: a page never goes stale (new posts come as the pill).
    staleTime: Infinity,
    enabled: Boolean(params),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getBrowserClient().rpc("feed_page", {
        p_tab: params!.tab, p_sort: params!.sort, p_kind: params!.kind, p_tag: params!.tag, p_community: params!.community,
        p_cursor: pageParam, p_as_of: first.as_of, p_limit: PAGE,
      });
      if (error) throw new Error(error.message);
      return data as FeedPage;
    },
    getNextPageParam: (last) => (params && last.next ? last.next : undefined),
  });

  // Posts from every page (a post that moved between pages shows once), with club-verified proof woven
  // in: For you every few posts, the other tabs in time order.
  const { rows, leftover } = useMemo(() => {
    const seen = new Set<string>();
    const cards = (q.data?.pages ?? [first]).flatMap((p) => p.items).filter((c) => !seen.has(c.id) && seen.add(c.id));
    const out: { key: string; node: ReactNode }[] = [];
    const card = (c: Card, i: number) => ({
      key: `post:${c.id}`,
      node: <PostCard post={c} liked={c.liked} saved={c.saved} own={c.author_id === me} index={i} project={c.project} reason={c.author_id === me ? "" : c.reason} replies={c.replies} viewer={viewer} />,
    });
    const proof = (p: ProofItem) => ({ key: `proof:${p.proof.id}`, node: <ProofCard p={p.proof} reason={p.reason} /> });
    const done = !q.hasNextPage;
    if (ranked) {
      let j = 0;
      cards.forEach((c, i) => { out.push(card(c, i)); if (i % 5 === 2 && j < proofs.length) out.push(proof(proofs[j++])); });
      if (done) while (j < proofs.length) out.push(proof(proofs[j++]));
    } else {
      const old = params?.sort === "old";
      const left = [...proofs].sort((a, b) => (old ? a.at - b.at : b.at - a.at));
      cards.forEach((c, i) => {
        const t = Date.parse(c.created_at);
        while (left.length && (old ? left[0].at < t : left[0].at > t)) out.push(proof(left.shift()!));
        out.push(card(c, i));
      });
      if (done) left.forEach((p) => out.push(proof(p)));
    }
    // Discovery strips at fixed spots (after the 2nd and 5th item), as before; on a short feed, the
    // ones past its end show after it.
    return {
      rows: out.flatMap((r, i) => (slots[i] ? [r, { key: `slot:${i}`, node: slots[i] }] : [r])),
      leftover: done ? Object.entries(slots).filter(([i]) => Number(i) >= out.length) : [],
    };
  }, [q.data, q.hasNextPage, first, proofs, ranked, params?.sort, slots, me, viewer]);

  // The list's distance from the top of the page (the composer and filters sit above it).
  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setMargin(Math.round(el.getBoundingClientRect().top + window.scrollY));
    measure();
    const ro = new ResizeObserver(measure);
    if (el.parentElement) ro.observe(el.parentElement);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const memo = JSON.stringify(key);
  const v = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 460,
    overscan: 4,
    scrollMargin: margin,
    getItemKey: (i) => rows[i]?.key ?? i,
    // Server render and the first paint: the first few cards, so posts show before any script runs.
    initialRect: { width: 0, height: 1400 },
    initialMeasurementsCache: remembered.get(memo),
  });
  useEffect(() => () => { remembered.set(memo, v.measurementsCache); }, [memo, v]);

  // Two screens before the end, ask for the next page.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage(); }, { rootMargin: "0px 0px 200% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, rows.length]);

  const items = v.getVirtualItems();
  return (
    <>
      <div ref={listRef} data-feed-list style={{ height: v.getTotalSize(), position: "relative" }}>
        {items.map((it) => (
          <div key={it.key} data-index={it.index} ref={v.measureElement} className="absolute top-0 left-0 w-full pb-4" style={{ transform: `translateY(${it.start - v.options.scrollMargin}px)` }}>
            {rows[it.index]?.node}
          </div>
        ))}
      </div>
      {/* Strips meant for later spots still show when the feed is short. */}
      {leftover.map(([i, node]) => <Fragment key={`slot-${i}`}>{node}</Fragment>)}
      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingNextPage && <div aria-hidden className="h-48 shimmer rounded-3xl" />}
      {isFetchNextPageError && (
        <div className="glass-card rounded-3xl p-5 text-center text-sm">
          <p className="text-muted">Couldn&apos;t load more posts.</p>
          <button type="button" onClick={() => void fetchNextPage()} className="mt-2 rounded-full border border-line px-3.5 py-1.5 transition hover:border-line-strong">Try again</button>
        </div>
      )}
      {!hasNextPage && rows.length > 0 && end}
    </>
  );
}

// New posts arrive as a pill instead of the page jumping under you. Likes and comments update
// in place (on the card), so only new posts are counted. Tapping it loads a fresh first page.
export function NewPosts({ me }: { me: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sb = getBrowserClient();
    const ch = sb.channel(`feed-new-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (p: { new: unknown }) => {
        const row = p.new as { author_id?: string; status?: string };
        if (row.author_id === me) return; // the composer refreshes the feed after your own post
        if (row.status && row.status !== "visible") return;
        setCount((n) => n + 1);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [me]);
  if (!count) return null;
  return (
    <div className="pointer-events-none sticky top-[calc(var(--m-top)+3.5rem)] z-30 flex justify-center md:top-20">
      <button
        type="button"
        onClick={() => { setCount(0); router.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="bg-accent-grad pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-on-accent transition active:scale-95"
      >
        <ArrowUp className="size-4" /> {count} new {count === 1 ? "post" : "posts"}
      </button>
    </div>
  );
}
