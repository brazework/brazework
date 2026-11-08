"use client";
import { ArrowUp, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { addComment, deleteComment } from "@/lib/posts";

export function CommentForm({ postId }: { postId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      setError("");
      const r = await addComment(postId, body);
      if (r.ok) setBody("");
      else setError(r.message);
    });
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor="comment" className="sr-only">Write a comment</label>
        <input id="comment" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Add a comment" autoComplete="off" className={cn(inputCls, "rounded-full")} />
        <button type="submit" disabled={pending || !body.trim()} aria-label="Post comment" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition hover:opacity-90 disabled:opacity-40">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}

export function DeleteComment({ postId, commentId }: { postId: string; commentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label="Delete comment"
      disabled={pending}
      onClick={() => confirm("Delete this comment?") && start(async () => { await deleteComment(postId, commentId); })}
      className="ml-auto text-faint transition hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
