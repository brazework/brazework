"use client";
import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

const STEP = 12;

// The feed, shown a dozen at a time as you scroll (the page already has them, so there's no wait),
// with discovery strips woven in at fixed spots and a calm end instead of a dead stop.
export function FeedList({ items, slots, end }: { items: { key: string; node: ReactNode }[]; slots: Record<number, ReactNode>; end: ReactNode }) {
  const [shown, setShown] = useState(STEP);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = shown < items.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setShown((n) => n + STEP); }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);
  return (
    <>
      {items.slice(0, shown).map((it, i) => (
        <Fragment key={it.key}>
          {it.node}
          {slots[i]}
        </Fragment>
      ))}
      {/* Strips meant for later spots still show when the feed is short. */}
      {!more && Object.entries(slots).filter(([i]) => Number(i) >= items.length).map(([i, node]) => <Fragment key={`slot-${i}`}>{node}</Fragment>)}
      {more ? <div ref={sentinel} aria-hidden className="h-24 shimmer rounded-3xl" /> : end}
    </>
  );
}

// New posts arrive as a pill instead of the page jumping under you. Likes and comments update
// in place (optimistic on the card), so only new posts are counted.
export function NewPosts({ me }: { me: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sb = getBrowserClient();
    const ch = sb.channel(`feed-new-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (p: { new: unknown }) => {
        const row = p.new as { author_id?: string; status?: string };
        if (row.author_id === me) { router.refresh(); return; }
        if (row.status && row.status !== "visible") return;
        setCount((n) => n + 1);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [me, router]);
  if (!count) return null;
  return (
    <div className="pointer-events-none sticky top-[calc(var(--m-top)+3.5rem)] z-30 flex justify-center md:top-20">
      <button
        type="button"
        onClick={() => { setCount(0); router.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="bg-accent-grad pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-on-accent shadow-[0_12px_28px_-12px_var(--accent)] transition hover:-translate-y-px active:scale-95"
      >
        <ArrowUp className="size-4" /> {count} new {count === 1 ? "post" : "posts"}
      </button>
    </div>
  );
}
