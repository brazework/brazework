"use client";
import { ArrowUp, Heart, Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar, inputCls } from "@/components/ui";
import { cn, timeAgo } from "@/lib/forge";
import { addComment, deleteComment, editComment, toggleCommentLike } from "@/lib/posts";

export type ThreadComment = { id: string; author_id: string; author_first: string; author_last: string; body: string; created_at: string; parent_id?: string | null; edited_at?: string | null; like_count?: number };

export function CommentForm({ postId, parentId, replyingTo, autoFocus = false, onDone, compact = false }: { postId: string; parentId?: string; replyingTo?: string; autoFocus?: boolean; onDone?: () => void; compact?: boolean }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const id = parentId ? `reply-${parentId}` : "comment";
  const send = () =>
    start(async () => {
      setError("");
      const r = await addComment(postId, body, parentId);
      if (r.ok) { setBody(""); onDone?.(); }
      else setError(r.message);
    });
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className={cn("flex flex-col gap-2", compact ? "mt-2" : "mt-5")}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">{parentId ? `Reply to ${replyingTo ?? "this comment"}` : "Write a comment"}</label>
        <input id={id} autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && onDone) onDone(); }} maxLength={1000} placeholder={parentId ? `Reply to ${replyingTo ?? "this comment"}` : "Add a comment"} autoComplete="off" className={cn(inputCls, "rounded-full", compact && "h-9 text-sm")} />
        <button type="submit" disabled={pending || !body.trim()} aria-label={parentId ? "Post reply" : "Post comment"} className={cn("grid shrink-0 place-items-center rounded-full bg-accent text-on-accent transition hover:opacity-90 disabled:opacity-40", compact ? "size-9" : "size-11")}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}

// The conversation under a post: comments, each with its replies one level in. Like, reply, edit
// (your own) and delete (your own, or any on your post).
export function CommentThread({ postId, comments, me, postAuthor, liked, threads }: { postId: string; comments: ThreadComment[]; me: string; postAuthor: string; liked: string[]; threads: boolean }) {
  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const likedSet = new Set(liked);
  const [replyTo, setReplyTo] = useState<{ thread: string; name: string } | null>(null);
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {top.map((c) => {
        const replies = repliesOf(c.id);
        return (
          <li key={c.id} className="flex flex-col gap-3">
            <CommentItem postId={postId} c={c} me={me} postAuthor={postAuthor} liked={likedSet.has(c.id)} threads={threads} onReply={() => setReplyTo({ thread: c.id, name: c.author_first || "them" })} />
            {(replies.length > 0 || replyTo?.thread === c.id) && (
              <ul aria-label={`Replies to ${c.author_first}`} className="ml-[2.75rem] flex flex-col gap-3 border-l border-line pl-3">
                {replies.map((r) => (
                  <li key={r.id}>
                    <CommentItem postId={postId} c={r} me={me} postAuthor={postAuthor} liked={likedSet.has(r.id)} threads={threads} small onReply={() => setReplyTo({ thread: c.id, name: r.author_first || "them" })} />
                  </li>
                ))}
                {replyTo?.thread === c.id && (
                  <li><CommentForm postId={postId} parentId={c.id} replyingTo={replyTo.name} autoFocus compact onDone={() => setReplyTo(null)} /></li>
                )}
              </ul>
            )}
          </li>
        );
      })}
      {!top.length && <li className="text-sm text-muted">No comments yet. Start the conversation.</li>}
    </ul>
  );
}

function CommentItem({ postId, c, me, postAuthor, liked, threads, small = false, onReply }: { postId: string; c: ThreadComment; me: string; postAuthor: string; liked: boolean; threads: boolean; small?: boolean; onReply: () => void }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [error, setError] = useState("");
  // Your like shows at once; the count is the server's, moved by your own change.
  const [like, setLike] = useState(liked);
  const likes = Math.max(0, (c.like_count ?? 0) + Number(like) - Number(liked));
  const mine = c.author_id === me;
  const canDelete = mine || postAuthor === me;

  const toggleLike = () => {
    const next = !like;
    setLike(next);
    start(async () => { const r = await toggleCommentLike(postId, c.id, next); if (!r.ok) { setLike(!next); setError(r.message); } });
  };
  const save = () => start(async () => {
    setError("");
    const r = await editComment(postId, c.id, draft);
    if (r.ok) setEditing(false); else setError(r.message);
  });
  const remove = () => {
    if (!confirm(c.parent_id ? "Delete this reply?" : "Delete this comment? Its replies go too.")) return;
    start(async () => { const r = await deleteComment(postId, c.id); if (!r.ok) setError(r.message); });
  };

  return (
    <div className="group flex gap-3">
      <Link href={`/u/${c.author_id}`} aria-hidden="true" tabIndex={-1}><Avatar first={c.author_first} last={c.author_last} size={small ? 26 : 32} /></Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-surface-2 px-4 py-2.5">
          <div className="flex items-baseline gap-2 text-sm">
            <Link href={`/u/${c.author_id}`} className="font-medium hover:underline">{c.author_first} {c.author_last}</Link>
            <span className="text-xs text-faint">{timeAgo(c.created_at)}{c.edited_at ? " · edited" : ""}</span>
          </div>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-1.5">
              <label htmlFor={`edit-${c.id}`} className="sr-only">Edit your comment</label>
              <textarea id={`edit-${c.id}`} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setDraft(c.body); } if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }} maxLength={1000} rows={Math.min(6, Math.max(2, draft.split("\n").length))} className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-text" />
              <div className="mt-1.5 flex gap-2">
                <button type="submit" disabled={pending || !draft.trim() || draft.trim() === c.body} className="bg-accent-grad inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium text-on-accent disabled:opacity-50">{pending && <Loader2 className="size-3.5 animate-spin" />} Save</button>
                <button type="button" onClick={() => { setEditing(false); setDraft(c.body); setError(""); }} className="h-8 rounded-lg border border-line px-3.5 text-xs font-medium transition hover:bg-hover">Cancel</button>
              </div>
            </form>
          ) : (
            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{c.body}</p>
          )}
        </div>
        {/* Actions under the bubble. */}
        <div className="mt-1 flex items-center gap-1 pl-2 text-xs text-muted">
          {threads && (
            <button type="button" onClick={toggleLike} aria-pressed={like} aria-label={like ? "Unlike" : "Like"} className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2 transition hover:bg-hover", like ? "text-danger" : "hover:text-text")}>
              <Heart className={cn("size-3.5", like && "fill-current")} />{likes > 0 && <span className="tabular-nums">{likes}</span>}
            </button>
          )}
          {threads && (
            <button type="button" onClick={onReply} className="inline-flex h-7 items-center gap-1 rounded-full px-2 transition hover:bg-hover hover:text-text"><MessageSquare className="size-3.5" /> Reply</button>
          )}
          {mine && threads && !editing && (
            <button type="button" onClick={() => { setDraft(c.body); setEditing(true); }} className="inline-flex h-7 items-center gap-1 rounded-full px-2 transition hover:bg-hover hover:text-text"><Pencil className="size-3.5" /> Edit</button>
          )}
          {canDelete && (
            <button type="button" onClick={remove} disabled={pending} className="inline-flex h-7 items-center gap-1 rounded-full px-2 transition hover:bg-hover hover:text-danger"><Trash2 className="size-3.5" /> Delete</button>
          )}
          {error && <span role="alert" className="ml-1 text-danger">{error}</span>}
        </div>
      </div>
    </div>
  );
}
