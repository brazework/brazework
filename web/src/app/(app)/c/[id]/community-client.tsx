"use client";
import { motion } from "motion/react";
import { Check, ImagePlus, Loader2, Trash2, Video, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { Avatar, Button } from "@/components/ui";
import { POST_KINDS, cn } from "@/lib/forge";
import { AttachmentTray, useAttachments } from "@/components/media/attach";
import { approvePost, joinCommunity, leaveCommunity, postInCommunity, removeCommunityPost, withdrawRequest } from "../../communities/actions";

export function JoinButton({ cid, privacy, state, isOwner }: { cid: string; privacy: "public" | "approval"; state: "member" | "requested" | "none"; isOwner: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [party, setParty] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, celebrate = false) => start(async () => { const r = await fn(); setMsg(r.message); if (r.ok && celebrate) setParty(true); });
  if (isOwner) return null;
  return (
    <div className="relative flex flex-col items-end gap-1">
      {party && <Celebrate />}
      {state === "member" ? (
        <Button variant="outline" disabled={pending} onClick={() => confirm("Leave this community?") && run(() => leaveCommunity(cid))}>Leave</Button>
      ) : state === "requested" ? (
        <Button variant="outline" disabled={pending} onClick={() => run(() => withdrawRequest(cid))}>Requested · Withdraw</Button>
      ) : (
        <Button disabled={pending} onClick={() => run(() => joinCommunity(cid), privacy === "public")}>{pending && <Loader2 className="size-4 animate-spin" />} {privacy === "public" ? "Join" : "Ask to join"}</Button>
      )}
      {msg && <p role="status" className="max-w-56 text-right text-xs text-muted">{msg}</p>}
    </div>
  );
}

export function CommunityComposer({ cid, first, last, interests, topics, userId, mediaEnabled = false, captionsEnabled = false, avatarSrc }: { cid: string; first: string; last: string; interests: string[]; topics: string[]; userId: string; mediaEnabled?: boolean; captionsEnabled?: boolean; avatarSrc?: string | null }) {
  const att = useAttachments(userId);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("update");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();
  const options = [...new Set([...topics, ...interests])];
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pick = (files: FileList | File[]) => { if (mediaEnabled && files.length) void att.add(files); };
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 ? [...cur, t] : cur));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await postInCommunity(cid, body, kind, tags, att.media);
          if (r.ok) { setBody(""); setTags([]); att.clear(); setNote(r.message ? { text: r.message, error: false } : null); }
          else setNote({ text: r.message, error: true });
        });
      }}
      onDragOver={(e) => { if (mediaEnabled && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!mediaEnabled) return; e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
      className={cn("grad-edge relative rounded-3xl border p-4 shadow-[var(--shadow)] transition", dragging && "scale-[1.01]")}
    >
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files) pick(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { if (e.target.files) pick(e.target.files); e.target.value = ""; }} />
      {dragging && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-surface/90 text-sm font-medium backdrop-blur-sm">Drop photos or a video</div>}
      <div className="flex gap-3">
        <span className="h-fit rounded-full bg-accent-grad p-[2px]"><Avatar first={first} last={last} size={40} src={avatarSrc} className="border-2 border-surface" /></span>
        <label htmlFor="c-body" className="sr-only">Post to this community</label>
        <textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={body ? 4 : 2} onPaste={(e) => { const f = [...e.clipboardData.files]; if (f.length && mediaEnabled) { e.preventDefault(); pick(f); } }} placeholder="Share with the club: a build update, a photo, a question" className="flex-1 resize-none rounded-2xl bg-surface-2/60 px-4 py-2.5 text-[15px] leading-relaxed outline-none transition placeholder:text-faint focus:bg-transparent" />
      </div>
      {mediaEnabled && <AttachmentTray slots={att.slots} onRemove={att.remove} onRetry={att.retry} onEdit={att.edit} compare={att.compare} onCompare={att.setCompare} captions={captionsEnabled} />}
      <div role="radiogroup" aria-label="Post type" className="mt-3 inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
        {POST_KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className={cn("relative rounded-full px-3 py-1.5 text-xs font-medium transition", kind === k.id ? "text-on-accent" : "text-muted hover:text-text")}>
            {kind === k.id && <motion.span layoutId={`ckind-${cid}`} className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{k.label}</span>
          </button>
        ))}
      </div>
      {options.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">Tag up to 3:</span>
          {options.slice(0, 12).map((t) => <button key={t} type="button" aria-pressed={tags.includes(t)} disabled={!tags.includes(t) && tags.length >= 3} onClick={() => toggle(t)} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition disabled:opacity-40", tags.includes(t) ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-muted hover:text-text")}>#{t}{tags.includes(t) && <X className="size-3" />}</button>)}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button type="button" onClick={() => photoRef.current?.click()} disabled={!mediaEnabled || att.full} title={mediaEnabled ? undefined : "Photo and video are switching on soon"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition hover:bg-hover hover:text-text active:scale-95 disabled:pointer-events-none disabled:opacity-40"><ImagePlus className="size-[18px] text-sky-500" /> Photo</button>
        <button type="button" onClick={() => videoRef.current?.click()} disabled={!mediaEnabled || att.full} title={mediaEnabled ? undefined : "Photo and video are switching on soon"} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition hover:bg-hover hover:text-text active:scale-95 disabled:pointer-events-none disabled:opacity-40"><Video className="size-[18px] text-rose-500" /> Video</button>
        {(att.error || note) && <p role={att.error || note?.error ? "alert" : "status"} className={cn("text-sm", att.error || note?.error ? "text-danger" : "text-muted")}>{att.error || note?.text}</p>}
        <Button type="submit" className="ml-auto" disabled={pending || att.busy || !body.trim()}>{pending && <Loader2 className="size-4 animate-spin" />} Post</Button>
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
