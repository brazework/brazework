"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Check, FolderGit2, Heart, Link2, Lock, MessageSquare, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { POST_KINDS, cn, timeAgo, type Post, type PostProject } from "@/lib/forge";
import { MediaGrid } from "@/components/media/media-grid";
import { avatarSrc } from "@/lib/media";
import { deletePost, toggleSave } from "@/lib/posts";
import { EditPost } from "./edit-post";
import { toggleLike } from "./actions";

type Opt = { liked: boolean; count: number; saved: boolean };

export function PostCard({ post, liked, saved = false, own = false, index, project = null, reason = "" }: { post: Post & { community_name?: string | null }; liked: boolean; saved?: boolean; own?: boolean; index: number; project?: PostProject | null; reason?: string }) {
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const [editing, setEditing] = useState(false);
  // Shown right after an edit, before the page's data refreshes.
  const [edited, setEdited] = useState<{ body: string; tags: string[] } | null>(null);
  const body = edited?.body ?? post.body;
  const tags = edited?.tags ?? post.tags;
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

  // Likes celebrate: a burst around the heart, and a big heart when you double-click the post.
  const [burst, setBurst] = useState(0);
  const [bigHeart, setBigHeart] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const long = body.length > 420 || body.split("\n").length > 7;
  const like = (next: boolean) => {
    if (next) setBurst((n) => n + 1);
    act({ liked: next, count: opt.count + (next ? 1 : -1) }, () => toggleLike(post.id, next));
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/post/${post.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy the link.");
    }
  };

  if (gone) return null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="grad-edge relative rounded-3xl border p-5 shadow-[var(--shadow)] transition duration-300 hover:-translate-y-0.5"
      onDoubleClick={(e) => {
        if ((e.target as Element).closest("a,button,video,input,textarea")) return;
        window.getSelection()?.removeAllRanges();
        setBigHeart((n) => n + 1);
        if (!opt.liked) like(true);
      }}
    >
      <AnimatePresence>
        {bigHeart > 0 && (
          <motion.span
            key={bigHeart}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.25, 1, 1.1], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.9, times: [0, 0.3, 0.6, 1] }}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
            aria-hidden="true"
          >
            <Heart className="size-24 fill-[var(--accent)] text-accent drop-shadow-xl" />
          </motion.span>
        )}
      </AnimatePresence>
      <header className="flex items-center gap-3">
        <Link href={`/u/${post.author_id}`} aria-hidden="true" tabIndex={-1} className="rounded-full bg-accent-grad p-[2px]"><Avatar first={post.author_first} last={post.author_last} size={38} src={avatarSrc(post.author)} className="border-2 border-surface" /></Link>
        <div className="min-w-0">
          <Link href={`/u/${post.author_id}`} className="text-[15px] font-medium hover:underline">{post.author_first} {post.author_last}</Link>
          <div className="truncate text-xs text-faint">
            {post.author_headline}{post.author_headline && " · "}
            <Link href={`/post/${post.id}`} className="hover:underline">{timeAgo(post.created_at)}</Link>
            {(edited || post.edited_at) && <span title={post.edited_at ? `Edited ${new Date(post.edited_at).toLocaleString()}` : "Edited just now"}> · Edited</span>}
            {post.community_name && <> · {post.community_name}</>}
          </div>
        </div>
        <span className="ml-auto rounded-full bg-accent-grad px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-on-accent uppercase">{kind}</span>
      </header>
      {reason && <p className="mt-3 font-mono text-[11px] text-faint">{reason}</p>}
      {editing ? (
        <EditPost
          postId={post.id}
          body={body}
          tags={tags}
          onCancel={() => setEditing(false)}
          onSaved={(next) => { setEdited(next); setEditing(false); }}
        />
      ) : (
        <p className={cn("mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2", long && !expanded && "line-clamp-6")}>{body}</p>
      )}
      {!editing && long && <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-text hover:underline">{expanded ? "Show less" : "Show more"}</button>}
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
      {!editing && tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => <Link key={t} href={`/feed?tag=${encodeURIComponent(t)}`} className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition hover:border-line-strong hover:text-text">#{t}</Link>)}
        </div>
      )}
      <footer className="mt-4 flex items-center gap-1 text-sm text-faint">
        <button onClick={() => like(!opt.liked)} aria-pressed={opt.liked} aria-label={opt.liked ? "Unlike" : "Like"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text active:scale-90">
          <motion.span className="relative" animate={opt.liked ? { scale: [1, 1.35, 1] } : {}} transition={{ duration: 0.35 }}>
            {burst > 0 && <HeartBurst key={burst} />}
            <Heart className={cn("size-[18px] transition", opt.liked && "fill-[var(--accent)] text-accent")} />
          </motion.span>
          <span className={cn("tabular-nums", opt.liked && "text-accent")}>{opt.count}</span>
        </button>
        <Link href={`/post/${post.id}`} aria-label={`${post.comment_count} comments`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{post.comment_count}</span>
        </Link>
        <button onClick={() => act({ saved: !opt.saved }, () => toggleSave(post.id, !opt.saved))} aria-pressed={opt.saved} aria-label={opt.saved ? "Unsave" : "Save"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <Bookmark className={cn("size-[18px]", opt.saved && "fill-[var(--accent)] text-accent")} />
        </button>
        <button onClick={share} aria-label={copied ? "Link copied" : "Copy link to post"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-1.5">
              {copied ? <><Check className="size-[18px] text-ok" /><span className="text-xs text-ok">Copied</span></> : <Link2 className="size-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
        {own && !editing && (
          <button onClick={() => setEditing(true)} aria-label="Edit post" title="Edit post" className="inline-flex h-9 items-center rounded-full px-3 transition hover:bg-hover hover:text-text">
            <Pencil className="size-[18px]" />
          </button>
        )}
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

// Six sparks that fly out of the heart when you like something.
function HeartBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: Math.cos(a) * 18, y: Math.sin(a) * 18, scale: 0, opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="bg-accent-grad absolute top-1/2 left-1/2 -mt-[3px] -ml-[3px] size-1.5 rounded-full"
          />
        );
      })}
    </span>
  );
}
