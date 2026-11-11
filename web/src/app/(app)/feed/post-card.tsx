"use client";
import { AnimatePresence, motion } from "motion/react";
import { reportThis } from "@/components/report/report-dialog";
import { ArrowRight, ArrowUp, BadgeCheck, Bookmark, Check, FolderGit2, Heart, Link2, Loader2, Lock, MessageSquare, Pencil, Sparkles, Trash2, Flag } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { cardMark, markCard } from "@/lib/card-marks";
import { Avatar } from "@/components/ui";
import { POST_KINDS, cn, timeAgo, type Post, type PostProject } from "@/lib/forge";
import { MediaGrid } from "@/components/media/media-grid";
import { avatarSrc } from "@/lib/media";
import { addComment, deletePost, toggleSave } from "@/lib/posts";
import { EditPost } from "./edit-post";
import { SendPost } from "@/components/share/send-post";
import { MentionText } from "@/components/mentions/mention-text";
import { hashtagParts } from "@/lib/hashtags";
import { toggleLike } from "./actions";

type Opt = { liked: boolean; saved: boolean };

export type ReplyPreview = { id: string; author_id: string; author_first: string; author_last: string; body: string; created_at: string };
// Links in a card don't prefetch: every one scrolling past cost a server render and a sign-in check;
// a feed is browsed, not clicked through in bulk (Linear FIX-77). A tap still opens it at once.
const KIND_DOT: Record<string, string> = { result: "bg-ok", question: "bg-amber-500", project: "bg-sky-500" };

export function PostCard({ post, liked, saved = false, own = false, index, project = null, reason = "", replies = [], viewer }: { post: Post & { community_name?: string | null }; liked: boolean; saved?: boolean; own?: boolean; index: number; project?: PostProject | null; reason?: string; replies?: ReplyPreview[]; viewer?: { id: string; first: string; last: string } }) {
  const [, start] = useTransition();
  const [error, setError] = useState("");
  // What you did here this session survives the card scrolling out of the (virtualized) feed and back.
  const mark = cardMark(post.id);
  const [gone, setGoneState] = useState(Boolean(mark.gone));
  const setGone = (g: boolean) => { setGoneState(g); markCard(post.id, { gone: g }); };
  const [editing, setEditing] = useState(false);
  // Shown right after an edit, before the page's data refreshes.
  const [edited, setEditedState] = useState<{ body: string; tags: string[] } | null>(mark.edited ?? null);
  const setEdited = (e: { body: string; tags: string[] }) => { setEditedState(e); markCard(post.id, { edited: e }); };
  const body = edited?.body ?? post.body;
  const tags = edited?.tags ?? post.tags;
  const inline = new Set(hashtagParts(body).flatMap((p) => (typeof p === "string" ? [] : [p.tag])));
  const extraTags = tags.filter((t) => !inline.has(t));
  // Your like and save, held here (not re-fetched): the count is the server's, moved by your own change.
  const [opt, setOptState] = useState<Opt>({ liked: mark.liked ?? liked, saved: mark.saved ?? saved });
  const setOpt = (next: Partial<Opt>) => { setOptState((cur) => ({ ...cur, ...next })); markCard(post.id, next); };
  const likeCount = Math.max(0, post.like_count + Number(opt.liked) - Number(liked));
  const kind = POST_KINDS.find((k) => k.id === post.kind)?.label ?? "Update";
  const question = post.kind === "question";
  // Replies right in the feed: the latest two, plus yours as you post them.
  const [mine, setMineState] = useState<ReplyPreview[]>(mark.replies ?? []);
  const setMine = (f: (m: ReplyPreview[]) => ReplyPreview[]) => setMineState((m) => { const next = f(m); markCard(post.id, { replies: next }); return next; });
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

  // Shown at once; put back if the server says no.
  const act = (next: Partial<Opt>, fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      setError("");
      const before = { liked: opt.liked, saved: opt.saved };
      setOpt(next);
      const res = await fn().catch(() => ({ ok: false, message: "Couldn't save that. Check your connection." }));
      if (!res.ok) { setError(res.message); setOpt(before); }
    });

  // Likes celebrate: a burst around the heart, and a big heart when you double-click the post.
  const [burst, setBurst] = useState(0);
  const [bigHeart, setBigHeart] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const long = body.length > 420 || body.split("\n").length > 7;
  const like = (next: boolean) => {
    if (next) setBurst((n) => n + 1);
    act({ liked: next }, () => toggleLike(post.id, next));
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
      initial={mark.seen ? false : { opacity: 0, y: 16 }}
      onAnimationComplete={() => markCard(post.id, { seen: true })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="group/post glass-card relative rounded-3xl p-5 transition-shadow duration-300 hover:shadow-[0_18px_50px_-24px_rgb(0_0_0/0.35)]"
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
        <Link prefetch={false} href={`/u/${post.author_id}`} aria-hidden="true" tabIndex={-1} className="rounded-full bg-accent-grad p-[2px]"><Avatar first={post.author_first} last={post.author_last} size={38} src={avatarSrc(post.author)} className="border-2 border-surface" /></Link>
        <div className="min-w-0">
          <Link prefetch={false} href={`/u/${post.author_id}`} className="-my-[3px] inline-block py-[3px] text-[15px] font-medium hover:underline">{post.author_first} {post.author_last}</Link>
          <div className="truncate text-xs text-faint">
            {post.author_headline}{post.author_headline && " · "}
            <Link prefetch={false} suppressHydrationWarning href={`/post/${post.id}`} className="-my-1 inline-block min-w-6 py-1 text-center hover:underline">{timeAgo(post.created_at)}</Link>
            {(edited || post.edited_at) && <span title={post.edited_at ? `Edited ${new Date(post.edited_at).toLocaleString()}` : "Edited just now"}> · Edited</span>}
            {post.community_name && <> · {post.community_name}</>}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {post.kind !== "update" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted">
              <span className={cn("size-1.5 rounded-full", KIND_DOT[post.kind])} /> {kind}
              {question && replyCount === 0 && <span className="text-amber-700 dark:text-amber-300">· Unanswered</span>}
            </span>
          )}
          {/* The less-used actions, right where they apply: quiet until you hover the post (always there on touch). */}
          {!editing && (
            <span className="flex items-center opacity-0 transition-opacity duration-200 group-focus-within/post:opacity-100 group-hover/post:opacity-100 [@media(hover:none)]:opacity-100">
              {own ? (
                <>
                  <QuietAction label="Edit post" icon={Pencil} onClick={() => setEditing(true)} />
                  <QuietAction label="Delete post" icon={Trash2} danger onClick={() => { if (confirm("Delete this post? Its likes and comments go too.")) start(async () => { const r = await deletePost(post.id); if (r.ok) setGone(true); else setError(r.message); }); }} />
                </>
              ) : (
                <QuietAction label="Report post" icon={Flag} onClick={() => reportThis({ kind: "post", id: post.id, label: "this post" })} />
              )}
            </span>
          )}
        </div>
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
        <p className={cn("mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2", long && !expanded && "line-clamp-6")}><MentionText body={body} mentions={post.mentions} tags={tags} project={project} /></p>
      )}
      {!editing && long && <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-text hover:underline">{expanded ? "Show less" : "Show more"}</button>}
      {/* Tags written inline are already coloured in the text; only the rest get a line of their own. */}
      {!editing && extraTags.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[13px]">
          {extraTags.map((t) => <Link prefetch={false} key={t} href={`/feed?tag=${encodeURIComponent(t)}`} className="text-muted transition hover:text-text">#{t}</Link>)}
        </p>
      )}
      {post.media && post.media.length > 0 && <MediaGrid media={post.media} alt={`Shared by ${post.author_first} ${post.author_last}`} />}
      {project && <BuildStrip project={project} authorId={post.author_id} own={own} />}
      <footer className="mt-3 flex items-center gap-0.5 text-sm text-faint">
        <button onClick={() => like(!opt.liked)} aria-pressed={opt.liked} aria-label={opt.liked ? "Unlike" : "Like"} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text active:scale-90">
          <motion.span className="relative" animate={opt.liked ? { scale: [1, 1.35, 1] } : {}} transition={{ duration: 0.35 }}>
            {burst > 0 && <HeartBurst key={burst} />}
            <Heart className={cn("size-[18px] transition", opt.liked && "fill-[var(--accent)] text-accent")} />
          </motion.span>
          <RollingCount n={likeCount} className={cn(opt.liked && "text-accent")} />
        </button>
        {viewer ? (
          <button type="button" onClick={() => { setReplyOpen((v) => !v); requestAnimationFrame(() => replyRef.current?.focus()); }} aria-expanded={replyOpen} aria-label={`${question ? "Answer" : "Reply"} (${replyCount})`} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
            <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{replyCount}</span>
            {question && <span className="text-xs font-medium text-text-2">Answer</span>}
          </button>
        ) : (
          <Link prefetch={false} href={`/post/${post.id}`} aria-label={`${replyCount} comments`} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
            <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{replyCount}</span>
          </Link>
        )}
        <button onClick={() => act({ saved: !opt.saved }, () => toggleSave(post.id, !opt.saved))} aria-pressed={opt.saved} aria-label={opt.saved ? "Unsave" : "Save"} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          <Bookmark className={cn("size-[18px]", opt.saved && "fill-[var(--accent)] text-accent")} />
        </button>
        <SendPost postId={post.id} />
        <button type="button" onClick={share} aria-label={copied ? "Link copied" : "Copy link"} className="tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text">
          {copied ? <Check className="size-[18px] text-ok" /> : <Link2 className="size-[18px]" />}
          <AnimatePresence>{copied && <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-xs text-ok">Copied</motion.span>}</AnimatePresence>
        </button>
        {error && <span role="alert" className="ml-auto text-xs text-danger">{error}</span>}
      </footer>
      <AnimatePresence initial={false}>
      {(shown.length > 0 || replyOpen) && (
        <motion.div key="replies" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
        <div className="mt-2 space-y-2.5 border-t border-line pt-3">
          {replyCount > shown.length && <Link prefetch={false} href={`/post/${post.id}`} className="block text-xs font-medium text-muted hover:text-text">View all {replyCount} replies</Link>}
          {shown.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Link prefetch={false} href={`/u/${c.author_id}`} tabIndex={-1} aria-hidden="true" className="shrink-0"><Avatar first={c.author_first} last={c.author_last} size={28} /></Link>
              <div className="min-w-0 rounded-2xl bg-surface-2/70 px-3 py-2">
                <div className="text-xs"><Link prefetch={false} href={`/u/${c.author_id}`} className="font-medium text-text hover:underline">{`${c.author_first} ${c.author_last}`.trim()}</Link> <span className="text-faint">· {timeAgo(c.created_at)}</span></div>
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
        </motion.div>
      )}
      </AnimatePresence>
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

// A small icon button for the less-used actions (edit, delete, report), shown in the post's header.
function QuietAction({ label, icon: Icon, onClick, danger = false }: { label: string; icon: typeof Heart; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cn("tap grid size-8 place-items-center rounded-full text-faint transition hover:bg-hover active:scale-90", danger ? "hover:text-danger" : "hover:text-text")}>
      <Icon className="size-4" />
    </button>
  );
}

// The like count rolls to its new number instead of jumping.
function RollingCount({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden tabular-nums", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={n} initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>{n}</motion.span>
      </AnimatePresence>
    </span>
  );
}

// Under the photos and video: the work itself. Which project, how far along, its club-verified proof,
// what it's built with and its headline specs; the author gets a nudge to have it verified.
function BuildStrip({ project, authorId, own }: { project: PostProject; authorId: string; own: boolean }) {
  const v = project.verified ?? { n: 0, clubs: [] };
  const tools = project.tools ?? [];
  const specs = project.specs ?? [];
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface-2/50 p-3">
      {/* The verified badge sits beside the title when there's room, and drops under it on a phone. */}
      <Link prefetch={false} href={`/u/${authorId}#projects`} className="group/proj flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-raised text-muted transition group-hover/proj:text-text"><FolderGit2 className="size-[18px]" /></span>
        <span className="min-w-[min(100%,14rem)] flex-1 basis-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{project.title}</span>
            {project.private && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] text-muted"><Lock className="size-3" /> Private</span>}
          </span>
          <span className="block text-xs text-faint">{project.status === "completed" ? `Completed${project.year ? ` ${project.year}` : ""}` : `In progress · updated ${timeAgo(project.updated_at)}`}</span>
        </span>
        {v.n > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-ok" title={`Verified by ${v.clubs.join(", ")}`}>
            <BadgeCheck className="size-3.5" /> {v.n} verified{v.clubs[0] ? ` · ${v.clubs[0]}${v.clubs.length > 1 ? ` +${v.clubs.length - 1}` : ""}` : ""}
          </span>
        ) : (
          <ArrowRight className="size-4 shrink-0 text-faint transition group-hover/proj:translate-x-0.5 group-hover/proj:text-text" />
        )}
      </Link>
      {(tools.length > 0 || specs.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
          {specs.map((x) => <span key={x.label} className="inline-flex items-baseline gap-1 rounded-lg bg-surface px-2 py-1 text-xs"><span className="text-faint">{x.label}</span><span className="font-medium text-text">{x.value}</span></span>)}
          {tools.map((t) => <span key={t} className="rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-muted">{t}</span>)}
        </div>
      )}
      {own && v.n === 0 && !project.private && (
        <Link prefetch={false} href={`/u/${authorId}#projects`} className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs font-medium text-text-2 transition hover:text-text">
          <BadgeCheck className="size-3.5 text-accent" /> Ask your club to verify a milestone on this project <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
