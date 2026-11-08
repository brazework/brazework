"use client";
import { Check, Hash, Loader2, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar, Button } from "@/components/ui";
import { POST_KINDS, cn } from "@/lib/forge";
import { approvePost, joinCommunity, leaveCommunity, postInCommunity, removeCommunityPost, withdrawRequest } from "../../communities/actions";

export function JoinButton({ cid, privacy, state, isOwner }: { cid: string; privacy: "public" | "approval"; state: "member" | "requested" | "none"; isOwner: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); setMsg(r.message); });
  if (isOwner) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {state === "member" ? (
        <Button variant="outline" disabled={pending} onClick={() => confirm("Leave this community?") && run(() => leaveCommunity(cid))}>Leave</Button>
      ) : state === "requested" ? (
        <Button variant="outline" disabled={pending} onClick={() => run(() => withdrawRequest(cid))}>Requested · Withdraw</Button>
      ) : (
        <Button disabled={pending} onClick={() => run(() => joinCommunity(cid))}>{pending && <Loader2 className="size-4 animate-spin" />} {privacy === "public" ? "Join" : "Ask to join"}</Button>
      )}
      {msg && <p role="status" className="max-w-56 text-right text-xs text-muted">{msg}</p>}
    </div>
  );
}

export function CommunityComposer({ cid, first, last, interests, topics }: { cid: string; first: string; last: string; interests: string[]; topics: string[] }) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("update");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();
  const options = [...new Set([...topics, ...interests])];
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 ? [...cur, t] : cur));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await postInCommunity(cid, body, kind, tags);
          if (r.ok) { setBody(""); setTags([]); setNote(r.message ? { text: r.message, error: false } : null); }
          else setNote({ text: r.message, error: true });
        });
      }}
      className="rounded-3xl border border-line bg-surface/70 p-4"
    >
      <div className="flex gap-3">
        <Avatar first={first} last={last} size={40} />
        <label htmlFor="c-body" className="sr-only">Post to this community</label>
        <textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={body ? 4 : 2} placeholder="Share with the community" className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-faint" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {POST_KINDS.map((k) => <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent">{k.label}</button>)}
      </div>
      {options.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Hash className="size-3.5 text-faint" />
          {options.slice(0, 12).map((t) => <button key={t} type="button" aria-pressed={tags.includes(t)} disabled={!tags.includes(t) && tags.length >= 3} onClick={() => toggle(t)} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] transition disabled:opacity-40", tags.includes(t) ? "border-text text-text" : "border-line text-muted")}>{t}{tags.includes(t) && <X className="size-3" />}</button>)}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        {note && <p role={note.error ? "alert" : "status"} className={cn("text-sm", note.error ? "text-danger" : "text-muted")}>{note.text}</p>}
        <Button type="submit" className="ml-auto" disabled={pending || !body.trim()}>{pending && <Loader2 className="size-4 animate-spin" />} Post</Button>
      </div>
    </form>
  );
}

export function HeldActions({ cid, postId }: { cid: string; postId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2">
      {msg && <span className="mr-auto text-xs text-muted">{msg}</span>}
      <Button variant="ghost" disabled={pending} onClick={() => start(async () => setMsg((await removeCommunityPost(cid, postId)).message))}><Trash2 className="size-4" /> Remove</Button>
      <Button disabled={pending} onClick={() => start(async () => setMsg((await approvePost(cid, postId)).message))}><Check className="size-4" /> Publish</Button>
    </div>
  );
}

export function ModRemove({ cid, postId }: { cid: string; postId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-1 flex justify-end gap-2 px-2 text-xs">
      {msg && <span className="text-muted">{msg}</span>}
      <button disabled={pending} onClick={() => confirm("Remove this post from the community?") && start(async () => setMsg((await removeCommunityPost(cid, postId)).message))} className="inline-flex items-center gap-1 text-faint transition hover:text-danger">
        <Trash2 className="size-3.5" /> Remove as moderator
      </button>
    </div>
  );
}
