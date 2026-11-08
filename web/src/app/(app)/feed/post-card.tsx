"use client";
import { motion } from "motion/react";
import { Bookmark, FolderGit2, Heart, Lock, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { POST_KINDS, cn, timeAgo, type Post, type PostProject } from "@/lib/forge";
import { MediaGrid } from "@/components/media/media-grid";
import { avatarSrc } from "@/lib/media";
import { deletePost, toggleSave } from "@/lib/posts";
import { toggleLike } from "./actions";

type Opt = { liked: boolean; count: number; saved: boolean };

export function PostCard({ post, liked, saved = false, own = false, index, project = null, reason = "" }: { post: Post & { community_name?: string | null }; liked: boolean; saved?: boolean; own?: boolean; index: number; project?: PostProject | null; reason?: string }) {
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const [opt, setOpt] = useOptimistic<Opt, Partial<Opt>>({ liked, count: post.like_count, saved }, (cur, next) => ({ ...cur, ...next }));
  const kind = POST_KINDS.find((k) => k.id === post.kind)?.label ?? "Update";

  // On failure nothing is revalidated, so the optimistic state falls back to the server's.
  const act = (next: Partial<Opt>, fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      setError("");
      setOpt(next);
      const res = await fn().catch(() => ({ ok: false, message: "Couldn't save that. Check your connection." }));
      if (!res.ok) setError(res.message);
    });

  if (gone) return null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl border border-line bg-surface/70 p-5 transition hover:border-line-strong"
    >
      <header className="flex items-center gap-3">
        <Link href={`/u/${post.author_id}`} aria-hidden="true" tabIndex={-1}><Avatar first={post.author_first} last={post.author_last} size={40} src={avatarSrc(post.author)} /></Link>
        <div className="min-w-0">
          <Link href={`/u/${post.author_id}`} className="text-[15px] font-medium hover:underline">{post.author_first} {post.author_last}</Link>
          <div className="truncate text-xs text-faint">
            {post.author_headline}{post.author_headline && " · "}
            <Link href={`/post/${post.id}`} className="hover:underline">{timeAgo(post.created_at)}</Link>
            {post.community_name && <> · {post.community_name}</>}
          </div>
        </div>
        <span className="ml-auto rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-muted uppercase">{kind}</span>
      </header>
      {reason && <p className="mt-3 font-mono text-[11px] text-faint">{reason}</p>}
      <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{post.body}</p>
      {post.media && post.media.length > 0 && <MediaGrid media={post.media} alt={`Shared by ${post.author_first} ${post.author_last}`} />}
      {project && (
        <Link href={`/u/${post.author_id}#projects`} className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4 transition hover:border-line-strong">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-raised text-muted"><FolderGit2 className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-medium">
              <span className="truncate">{project.title}</span>
              {project.private && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] text-muted"><Lock className="size-3" /> Private</span>}
            </span>
            <span className="block text-xs text-faint">{project.status === "completed" ? `Completed${project.year ? ` ${project.year}` : ""}` : `In progress · updated ${timeAgo(project.updated_at)}`}</span>
          </span>
          <span className="shrink-0 text-sm text-muted">View project →</span>
        </Link>
      )}
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.map((t) => <Link key={t} href={`/feed?tag=${encodeURIComponent(t)}`} className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition hover:border-line-strong hover:text-text">#{t}</Link>)}
        </div>
      )}
      <footer className="mt-4 flex items-center gap-1 text-sm text-faint">
        <button onClick={() => act({ liked: !opt.liked, count: opt.count + (opt.liked ? -1 : 1) }, () => toggleLike(post.id, !opt.liked))} aria-pressed={opt.liked} aria-label={opt.liked ? "Unlike" : "Like"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <motion.span animate={opt.liked ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
            <Heart className={cn("size-[18px] transition", opt.liked && "fill-text text-text")} />
          </motion.span>
          <span className={cn("tabular-nums", opt.liked && "text-text")}>{opt.count}</span>
        </button>
        <Link href={`/post/${post.id}`} aria-label={`${post.comment_count} comments`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{post.comment_count}</span>
        </Link>
        <button onClick={() => act({ saved: !opt.saved }, () => toggleSave(post.id, !opt.saved))} aria-pressed={opt.saved} aria-label={opt.saved ? "Unsave" : "Save"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <Bookmark className={cn("size-[18px]", opt.saved && "fill-text text-text")} />
        </button>
        {own && (
          <button
            onClick={() => confirm("Delete this post? Its likes and comments go too.") && start(async () => { const r = await deletePost(post.id); if (r.ok) setGone(true); else setError(r.message); })}
            aria-label="Delete post"
            className="inline-flex h-9 items-center rounded-full px-3 transition hover:bg-hover hover:text-danger"
          >
            <Trash2 className="size-[18px]" />
          </button>
        )}
        {error && <span role="alert" className="ml-auto text-xs text-danger">{error}</span>}
      </footer>
    </motion.article>
  );
}
