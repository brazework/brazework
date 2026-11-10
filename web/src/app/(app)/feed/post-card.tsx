"use client";
import { AnimatePresence, motion } from "motion/react";
import { reportThis } from "@/components/report/report-dialog";
import { ArrowUp, Bookmark, Check, FolderGit2, Heart, Link2, Loader2, Lock, MessageSquare, MoreHorizontal, Pencil, Sparkles, Trash2, Flag } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Avatar, menuCls, menuItemCls } from "@/components/ui";
import { POST_KINDS, cn, timeAgo, type Post, type PostProject } from "@/lib/forge";
import { MediaGrid } from "@/components/media/media-grid";
import { avatarSrc } from "@/lib/media";
import { addComment, deletePost, toggleSave } from "@/lib/posts";
import { EditPost } from "./edit-post";
import { SendPost } from "@/components/share/send-post";
import { MentionText } from "@/components/mentions/mention-text";
import { toggleLike } from "./actions";

type Opt = { liked: boolean; count: number; saved: boolean };

export type ReplyPreview = { id: string; author_id: string; author_first: string; author_last: string; body: string; created_at: string };
const KIND_DOT: Record<string, string> = { result: "bg-ok", question: "bg-amber-500", project: "bg-sky-500" };

export function PostCard({ post, liked, saved = false, own = false, index, project = null, reason = "", replies = [], viewer }: { post: Post & { community_name?: string | null }; liked: boolean; saved?: boolean; own?: boolean; index: number; project?: PostProject | null; reason?: string; replies?: ReplyPreview[]; viewer?: { id: string; first: string; last: string } }) {
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
  const question = post.kind === "question";
  // Replies right in the feed: the latest two, plus yours as you post them.
  const [mine, setMine] = useState<ReplyPreview[]>([]);
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  // Yours stay "pending" only until the server's copy arrives with the refreshed feed.
  const pending = mine.filter((m) => !replies.some((r) => r.author_id === m.author_id && r.body === m.body));
  const shown = [...replies, ...pending];
  const replyCount = post.comment_count + pending.length;
  const sendReply = async () => {
    const text = draft.trim();
    if (!text || sending || !viewer) return;
    setSending(true); setError("");
    const r = await addComment(post.id, text).catch(() => ({ ok: false, message: "Couldn't send that. Check your connection." }));
    setSending(false);
    if (!r.ok) { setError(r.message); return; }
    setMine((m) => [...m, { id: `me-${Date.now()}`, author_id: viewer.id, author_first: viewer.first, author_last: viewer.last, body: text, created_at: new Date().toISOString() }]);
    setDraft("");
  };

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
      className="glass-card relative rounded-3xl p-5 transition duration-300 hover:-translate-y-0.5"
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
      {reason && <p className="mb-3 flex items-center gap-1.5 text-xs text-faint"><Sparkles className="size-3.5 shrink-0" /> {reason}</p>}
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
        {post.kind !== "update" && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
            <span className={cn("size-1.5 rounded-full", KIND_DOT[post.kind])} /> {kind}
            {question && replyCount === 0 && <span className="rounded-full bg-[color-mix(in_oklab,#f59e0b_14%,transparent)] px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">Unanswered</span>}
          </span>
        )}
      </header>
      {editing ? (
        <EditPost
          postId={post.id}
          body={body}
          tags={tags}
          onCancel={() => setEditing(false)}
          onSaved={(next) => { setEdited(next); setEditing(false); }}
        />
      ) : (
        <p className={cn("mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2", long && !expanded && "line-clamp-6")}><MentionText body={body} mentions={post.mentions} /></p>
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => <Link key={t} href={`/feed?tag=${encodeURIComponent(t)}`} className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition hover:border-line-strong hover:text-text">#{t}</Link>)}
        </div>
      )}
      <footer className="mt-3 flex items-center gap-0.5 text-sm text-faint">
        <button onClick={() => like(!opt.liked)} aria-pressed={opt.liked} aria-label={opt.liked ? "Unlike" : "Like"} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text active:scale-90">
          <motion.span className="relative" animate={opt.liked ? { scale: [1, 1.35, 1] } : {}} transition={{ duration: 0.35 }}>
            {burst > 0 && <HeartBurst key={burst} />}
            <Heart className={cn("size-[18px] transition", opt.liked && "fill-[var(--accent)] text-accent")} />
          </motion.span>
          <span className={cn("tabular-nums", opt.liked && "text-accent")}>{opt.count}</span>
        </button>
        {viewer ? (
          <button type="button" onClick={() => { setReplyOpen((v) => !v); requestAnimationFrame(() => replyRef.current?.focus()); }} aria-expanded={replyOpen} aria-label={`${question ? "Answer" : "Reply"} (${replyCount})`} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
            <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{replyCount}</span>
            {question && <span className="text-xs font-medium text-text-2">Answer</span>}
          </button>
        ) : (
          <Link href={`/post/${post.id}`} aria-label={`${replyCount} comments`} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
            <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{replyCount}</span>
          </Link>
        )}
        <button onClick={() => act({ saved: !opt.saved }, () => toggleSave(post.id, !opt.saved))} aria-pressed={opt.saved} aria-label={opt.saved ? "Unsave" : "Save"} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <Bookmark className={cn("size-[18px]", opt.saved && "fill-[var(--accent)] text-accent")} />
        </button>
        <SendPost postId={post.id} />
        <MoreMenu
          items={[
            { label: copied ? "Link copied" : "Copy link", icon: copied ? Check : Link2, onSelect: share },
            ...(own && !editing ? [{ label: "Edit post", icon: Pencil, onSelect: () => setEditing(true) }] : []),
            ...(!own ? [{ label: "Report post", icon: Flag, onSelect: () => reportThis({ kind: "post", id: post.id, label: "this post" }) }] : []),
            ...(own ? [{ label: "Delete post", icon: Trash2, danger: true, onSelect: () => { if (confirm("Delete this post? Its likes and comments go too.")) start(async () => { const r = await deletePost(post.id); if (r.ok) setGone(true); else setError(r.message); }); } }] : []),
          ]}
        />
        {error && <span role="alert" className="ml-auto text-xs text-danger">{error}</span>}
      </footer>
      {(shown.length > 0 || replyOpen) && (
        <div className="mt-2 space-y-2.5 border-t border-line pt-3">
          {replyCount > shown.length && <Link href={`/post/${post.id}`} className="block text-xs font-medium text-muted hover:text-text">View all {replyCount} replies</Link>}
          {shown.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Link href={`/u/${c.author_id}`} className="shrink-0"><Avatar first={c.author_first} last={c.author_last} size={28} /></Link>
              <div className="min-w-0 rounded-2xl bg-surface-2/70 px-3 py-2">
                <div className="text-xs"><Link href={`/u/${c.author_id}`} className="font-medium text-text hover:underline">{`${c.author_first} ${c.author_last}`.trim()}</Link> <span className="text-faint">· {timeAgo(c.created_at)}</span></div>
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{c.body}</p>
              </div>
            </div>
          ))}
          {replyOpen && viewer && (
            <form onSubmit={(e) => { e.preventDefault(); void sendReply(); }} className="flex items-end gap-2.5">
              <Avatar first={viewer.first} last={viewer.last} size={28} className="mb-1.5" />
              <textarea
                ref={replyRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                rows={1}
                maxLength={1000}
                aria-label={question ? "Write an answer" : "Write a reply"}
                placeholder={question ? "Write an answer…" : "Write a reply…"}
                className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-surface px-3.5 py-2 text-sm outline-none focus:border-line-strong"
              />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send reply" className="bg-accent-grad grid size-10 shrink-0 place-items-center rounded-full text-on-accent transition active:scale-90 disabled:opacity-40">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </form>
          )}
        </div>
      )}
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

// The "⋯" menu for the less-used actions, so the row under a post stays short.
function MoreMenu({ items }: { items: { label: string; icon: typeof Heart; onSelect: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="More actions" className="tap inline-flex h-9 items-center rounded-full px-3 transition hover:bg-hover hover:text-text">
        <MoreHorizontal className="size-[18px]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }} transition={{ duration: 0.12 }} className={cn(menuCls, "absolute bottom-full left-0 z-30 mb-1 w-48 overflow-hidden")}>
            {items.map((it) => (
              <button key={it.label} role="menuitem" type="button" onClick={() => { it.onSelect(); if (it.label !== "Copy link") setOpen(false); }} className={cn(menuItemCls, it.danger && "text-danger hover:text-danger")}>
                <it.icon className="size-4" /> {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
