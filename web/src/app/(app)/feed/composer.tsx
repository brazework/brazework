"use client";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, HelpCircle, ImagePlus, Loader2, Megaphone, Rocket, Upload, Video, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { POST_KINDS, cn } from "@/lib/forge";
import { createPost, type ComposeState } from "./actions";
import { submitWithoutReset } from "@/lib/submit";
import { AttachmentTray, useAttachments } from "@/components/media/attach";

const KIND_ICON = { update: Megaphone, question: HelpCircle, result: FlaskConical, project: Rocket } as const;
const MAX = 3000;

// The feed composer. Collapsed, it's a prompt plus one-tap shortcuts (photo, video, result,
// question); open, it's the full editor. Photos and videos can also be dropped onto it or pasted.
export function Composer({ first, last, interests, userId, mediaEnabled = false, avatarSrc }: { first: string; last: string; interests: string[]; userId: string; mediaEnabled?: boolean; avatarSrc?: string | null }) {
  const [state, action, pending] = useActionState<ComposeState, FormData>(createPost, { ok: false, message: "", nonce: 0 });
  const [kind, setKind] = useState<string>("update");
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const att = useAttachments(userId);

  // Clear after a successful post (adjusting state during render, not in an effect).
  const [seenNonce, setSeenNonce] = useState(0);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    setBody("");
    setTags([]);
    setKind("update");
    setOpen(false);
    att.clear();
  }

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 ? [...cur, t] : cur));
  const expand = (k?: string) => {
    if (k) setKind(k);
    setOpen(true);
    requestAnimationFrame(() => textRef.current?.focus());
  };
  const pickFiles = (files: FileList | File[]) => {
    if (!mediaEnabled || !files.length) return;
    setOpen(true);
    void att.add(files);
  };
  const remaining = MAX - body.length;

  return (
    <form
      ref={formRef}
      onSubmit={submitWithoutReset(action)}
      onDragOver={(e) => { if (mediaEnabled && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!mediaEnabled) return; e.preventDefault(); setDragging(false); pickFiles(e.dataTransfer.files); }}
      className={cn("grad-edge relative rounded-3xl border p-4 shadow-[var(--shadow)] transition", dragging && "scale-[1.01]")}
    >
      <input type="hidden" name="kind" value={kind} />
      {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
      <input type="hidden" name="media" value={JSON.stringify(att.media)} />
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />

      <div className="flex gap-3">
        <span className="h-fit rounded-full bg-accent-grad p-[2px]"><Avatar first={first} last={last} size={40} src={avatarSrc} className="border-2 border-surface" /></span>
        <textarea
          ref={textRef}
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setOpen(true)}
          onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.length && mediaEnabled) { e.preventDefault(); pickFiles(files); } }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formRef.current?.requestSubmit(); }}
          maxLength={MAX}
          rows={open ? 4 : 1}
          placeholder={`What are you building, ${first}?`}
          className="min-h-11 flex-1 resize-none rounded-2xl bg-surface-2/60 px-4 py-2.5 text-[15px] leading-relaxed text-text transition placeholder:text-faint focus:bg-transparent outline-none"
        />
      </div>

      {!open && (
        <div className="mt-3 flex flex-wrap gap-1 pl-[52px]">
          <Quick icon={ImagePlus} label="Photo" tint="text-sky-500" disabled={!mediaEnabled} onClick={() => photoRef.current?.click()} />
          <Quick icon={Video} label="Video" tint="text-rose-500" disabled={!mediaEnabled} onClick={() => videoRef.current?.click()} />
          <Quick icon={FlaskConical} label="Result" tint="text-emerald-500" onClick={() => expand("result")} />
          <Quick icon={HelpCircle} label="Question" tint="text-amber-500" onClick={() => expand("question")} />
          {!mediaEnabled && <span className="self-center text-[11px] text-faint">Photo and video are switching on soon</span>}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            {mediaEnabled && <AttachmentTray slots={att.slots} onRemove={att.remove} onEdit={att.edit} compare={att.compare} onCompare={att.setCompare} />}

            <div role="radiogroup" aria-label="Post type" className="mt-4 inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
              {POST_KINDS.map((k) => {
                const Icon = KIND_ICON[k.id];
                const on = kind === k.id;
                return (
                  <button key={k.id} type="button" role="radio" aria-checked={on} onClick={() => setKind(k.id)} className={cn("relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", on ? "text-on-accent" : "text-muted hover:text-text")}>
                    {on && <motion.span layoutId="compose-kind" className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <Icon className="relative size-3.5" /> <span className="relative">{k.label}</span>
                  </button>
                );
              })}
            </div>

            {interests.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-faint">Tag up to 3:</span>
                {interests.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => toggleTag(t)} aria-pressed={on} disabled={!on && tags.length >= 3} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition disabled:opacity-40", on ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-muted hover:border-line-strong hover:text-text")}>
                      #{t} {on && <X className="size-3" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Quick icon={ImagePlus} label="Photo" tint="text-sky-500" disabled={!mediaEnabled || att.full} onClick={() => photoRef.current?.click()} />
              <Quick icon={Video} label="Video" tint="text-rose-500" disabled={!mediaEnabled || att.full} onClick={() => videoRef.current?.click()} />
              {(att.error || state.message) && <p role="alert" className="text-sm text-danger">{att.error || state.message}</p>}
              <span className="ml-auto flex items-center gap-3">
                <CharRing used={body.length} max={MAX} />
                {remaining <= 200 && <span className={cn("text-xs tabular-nums", remaining < 0 ? "text-danger" : "text-faint")}>{remaining}</span>}
                <button type="button" onClick={() => { setOpen(false); }} className="text-sm text-muted transition hover:text-text">Cancel</button>
                <Button type="submit" disabled={pending || att.busy || !body.trim()}>
                  {pending && <Loader2 className="size-4 animate-spin" />} Post
                </Button>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-surface/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-sm font-medium"><Upload className="size-6 text-accent" /> Drop photos or a video</div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function Quick({ icon: Icon, label, tint, onClick, disabled }: { icon: typeof ImagePlus; label: string; tint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition hover:bg-hover hover:text-text active:scale-95 disabled:pointer-events-none disabled:opacity-40">
      <Icon className={cn("size-[18px]", tint)} /> {label}
    </button>
  );
}

// How much of the 3,000 characters is used, as a small ring that fills in.
function CharRing({ used, max }: { used: number; max: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pct = Math.min(used / max, 1);
  return (
    <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-label={`${used} of ${max} characters`} role="img">
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
      <circle cx="12" cy="12" r={r} fill="none" stroke={pct > 0.93 ? "var(--danger)" : "var(--accent)"} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-200" />
    </svg>
  );
}
