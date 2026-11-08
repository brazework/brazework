"use client";
import { AnimatePresence, motion } from "motion/react";
import { Hash, Loader2, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { POST_KINDS, cn } from "@/lib/forge";
import { createPost, type ComposeState } from "./actions";
import { submitWithoutReset } from "@/lib/submit";

export function Composer({ first, last, interests }: { first: string; last: string; interests: string[] }) {
  const [state, action, pending] = useActionState<ComposeState, FormData>(createPost, { ok: false, message: "", nonce: 0 });
  const [kind, setKind] = useState<string>("update");
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear after a successful post (adjusting state during render, not in an effect).
  const [seenNonce, setSeenNonce] = useState(0);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    setBody("");
    setTags([]);
    setOpen(false);
  }

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 ? [...cur, t] : cur));

  return (
    <form ref={formRef} onSubmit={submitWithoutReset(action)} className="rounded-3xl border border-line bg-surface/70 p-4 transition focus-within:border-line-strong">
      <input type="hidden" name="kind" value={kind} />
      {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
      <div className="flex gap-3">
        <Avatar first={first} last={last} size={40} />
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formRef.current?.requestSubmit(); }}
          maxLength={3000}
          rows={open ? 4 : 1}
          placeholder="What are you building, testing or stuck on?"
          className="min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-text placeholder:text-faint outline-none"
        />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {POST_KINDS.map((k) => (
                <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent">
                  {k.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Hash className="size-3.5 text-faint" />
              {interests.map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTag(t)} aria-pressed={on} disabled={!on && tags.length >= 3} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] transition disabled:opacity-40", on ? "border-accent/60 text-accent" : "border-line text-muted hover:text-text")}>
                    {t} {on && <X className="size-3" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
              <span className={cn("ml-auto font-mono text-[11px] tabular-nums", body.length > 2800 ? "text-danger" : "text-faint")}>{body.length}/3000</span>
              <Button type="submit" disabled={pending || !body.trim()}>
                {pending && <Loader2 className="size-4 animate-spin" />} Post
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
