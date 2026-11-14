"use client";
import { Heart, Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { cn, timeAgo } from "@/lib/forge";
import { deleteComment, editComment, toggleCommentLike } from "@/lib/posts";
import type { ReplyPreview } from "./post-card";

// One comment in a feed card's preview, with what you can do to it right there: like it, reply to
// it, and edit or delete it if it's yours (or delete any comment on your own post). Likes, replies
// and edits need step 53 (supabase/comment-threads.sql); before it, a comment just shows.
export function FeedComment({ postId, c, me, postIsMine, onReply }: { postId: string; c: ReplyPreview; me?: string; postIsMine: boolean; onReply?: (c: ReplyPreview) => void }) {
  const threads = c.like_count !== undefined;
  const [pending, start] = useTransition();
  const [body, setBody] = useState(c.body);
  const [draft, setDraft] = useState(c.body);
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState("");
  const [like, setLike] = useState(!!c.liked);
  const likes = Math.max(0, (c.like_count ?? 0) + Number(like) - Number(!!c.liked));
  const mine = !!me && c.author_id === me;
  const real = !c.id.startsWith("me-"); // a reply you just sent, before the server's copy arrives
  if (gone) return null;

  const toggleLike = () => {
    const next = !like;
    setLike(next);
    start(async () => { const r = await toggleCommentLike(postId, c.id, next); if (!r.ok) { setLike(!next); setError(r.message); } });
  };
  const save = () => start(async () => {
    setError("");
    const r = await editComment(postId, c.id, draft);
    if (r.ok) { setBody(draft.trim()); setEditing(false); } else setError(r.message);
  });
  const remove = () => {
    if (!confirm(c.parent_id ? "Delete this reply?" : "Delete this comment? Its replies go too.")) return;
    start(async () => { const r = await deleteComment(postId, c.id); if (r.ok) setGone(true); else setError(r.message); });
  };
  const act = "inline-flex h-6 items-center gap-1 rounded-md px-1.5 transition hover:bg-hover hover:text-text";

  return (
    <div className={cn("flex gap-2.5", c.parent_id && "ml-9")}>
      <Link prefetch={false} href={`/u/${c.author_id}`} tabIndex={-1} aria-hidden="true" className="shrink-0"><Avatar first={c.author_first} last={c.author_last} size={c.parent_id ? 24 : 28} /></Link>
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-2xl bg-surface-2/70 px-3 py-2">
          <div className="text-xs"><Link prefetch={false} href={`/u/${c.author_id}`} className="font-medium text-text hover:underline">{`${c.author_first} ${c.author_last}`.trim()}</Link> <span className="text-faint">· {timeAgo(c.created_at)}{c.edited_at ? " · edited" : ""}</span></div>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-1">
              <label htmlFor={`fe-${c.id}`} className="sr-only">Edit your comment</label>
              <textarea id={`fe-${c.id}`} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setDraft(body); } if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }} rows={2} maxLength={1000} className="w-full min-w-56 resize-y rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-line-strong" />
              <div className="mt-1 flex gap-1.5 text-xs">
                <button type="submit" disabled={pending || !draft.trim() || draft.trim() === body} className="bg-accent-grad inline-flex h-7 items-center gap-1 rounded-lg px-2.5 font-medium text-on-accent disabled:opacity-50">{pending && <Loader2 className="size-3 animate-spin" />} Save</button>
                <button type="button" onClick={() => { setEditing(false); setDraft(body); setError(""); }} className="h-7 rounded-lg border border-line px-2.5 font-medium hover:bg-hover">Cancel</button>
              </div>
            </form>
          ) : (
            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{body}</p>
          )}
        </div>
        {real && (threads || mine || postIsMine) && !editing && (
          <div className="mt-0.5 flex items-center gap-0.5 pl-1 text-[11px] text-muted">
            {threads && (
              <button type="button" onClick={toggleLike} aria-pressed={like} aria-label={like ? "Unlike comment" : "Like comment"} className={cn(act, like && "text-danger hover:text-danger")}>
                <Heart className={cn("size-3", like && "fill-current")} />{likes > 0 ? <span className="tabular-nums">{likes}</span> : "Like"}
              </button>
            )}
            {threads && onReply && <button type="button" onClick={() => onReply(c)} className={act}>Reply</button>}
            {threads && mine && <button type="button" onClick={() => { setDraft(body); setEditing(true); }} className={act}><Pencil className="size-3" /> Edit</button>}
            {(mine || postIsMine) && <button type="button" onClick={remove} disabled={pending} className={cn(act, "hover:text-danger")}><Trash2 className="size-3" /> Delete</button>}
            {error && <span role="alert" className="ml-1 text-danger">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
