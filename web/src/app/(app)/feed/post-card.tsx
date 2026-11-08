"use client";
import { motion } from "motion/react";
import { Heart, MessageSquare } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { POST_KINDS, cn, timeAgo, type Post } from "@/lib/forge";
import { toggleLike } from "./actions";

export function PostCard({ post, liked, index }: { post: Post; liked: boolean; index: number }) {
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const [opt, setOpt] = useOptimistic({ liked, count: post.like_count }, (_, next: { liked: boolean; count: number }) => next);
  const kind = POST_KINDS.find((k) => k.id === post.kind)?.label ?? "Update";

  const onLike = () =>
    start(async () => {
      const next = !opt.liked;
      setOpt({ liked: next, count: opt.count + (next ? 1 : -1) });
      // On failure nothing is revalidated, so the optimistic state falls back to the server's.
      const res = await toggleLike(post.id, next).catch(() => ({ ok: false, message: "Couldn't save that. Check your connection." }));
      if (!res.ok) setError(res.message);
    });

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl border border-line bg-surface/70 p-5 transition hover:border-line-strong"
    >
      <header className="flex items-center gap-3">
        <Avatar first={post.author_first} last={post.author_last} size={40} />
        <div className="min-w-0">
          <div className="text-[15px] font-medium">{post.author_first} {post.author_last}</div>
          <div className="truncate text-xs text-faint">{post.author_headline}{post.author_headline && " · "}{timeAgo(post.created_at)}</div>
        </div>
        <span className="ml-auto rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-accent uppercase">{kind}</span>
      </header>
      <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{post.body}</p>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.map((t) => <span key={t} className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted">#{t}</span>)}
        </div>
      )}
      <footer className="mt-4 flex items-center gap-6 text-sm text-faint">
        <button onClick={() => { setError(""); onLike(); }} aria-pressed={opt.liked} aria-label={opt.liked ? "Unlike" : "Like"} className="group inline-flex items-center gap-1.5 transition hover:text-accent">
          <motion.span whileTap={{ scale: 1.35 }} animate={opt.liked ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
            <Heart className={cn("size-[18px] transition", opt.liked && "fill-accent text-accent")} />
          </motion.span>
          <span className={cn("tabular-nums", opt.liked && "text-accent")}>{opt.count}</span>
        </button>
        <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-[18px]" /> <span className="tabular-nums">{post.comment_count}</span></span>
        {error && <span role="alert" className="ml-auto text-xs text-danger">{error}</span>}
      </footer>
    </motion.article>
  );
}
