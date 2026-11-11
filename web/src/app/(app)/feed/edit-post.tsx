"use client";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button, selectPillCls } from "@/components/ui";
import { cn, TOPICS } from "@/lib/forge";
import { MAX_TAGS, hashtagsIn } from "@/lib/hashtags";
import { editPost } from "@/lib/posts";

const MAX = 3000;

// Edit your own post in place: its text and up to 3 topics. Escape cancels, Ctrl/⌘+Enter saves.
export function EditPost({ postId, body, tags, onCancel, onSaved }: { postId: string; body: string; tags: string[]; onCancel: () => void; onSaved: (next: { body: string; tags: string[] }) => void }) {
  const [text, setText] = useState(body);
  const [picked, setPicked] = useState<string[]>(tags);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const changed = text.trim() !== body.trim() || picked.join("|") !== tags.join("|");
  const save = () =>
    start(async () => {
      setError("");
      const r = await editPost(postId, text, picked).catch(() => ({ ok: false, message: "Couldn't save. Check your connection." }));
      // The server adds any #tags written in the text (same rule, lib/hashtags.ts).
      if (r.ok) onSaved({ body: text.trim(), tags: [...new Set([...picked, ...hashtagsIn(text)])].slice(0, MAX_TAGS) });
      else setError(r.message);
    });

  return (
    <form
      className="mt-4 flex flex-col gap-3"
      onSubmit={(e) => { e.preventDefault(); if (changed && text.trim()) save(); }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && changed && text.trim()) { e.preventDefault(); save(); }
      }}
    >
      <label htmlFor={`${id}-body`} className="sr-only">Edit your post</label>
      <textarea
        ref={area}
        id={`${id}-body`}
        value={text}
        maxLength={MAX}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(12, Math.max(3, text.split("\n").length + 1))}
        className="w-full resize-y rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-line-strong"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-faint">Topics</span>
        {picked.map((t) => (
          <button key={t} type="button" onClick={() => setPicked(picked.filter((x) => x !== t))} aria-label={`Remove topic ${t}`} className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-0.5 font-mono text-[11px] text-text">
            #{t} <X className="size-3" />
          </button>
        ))}
        {picked.length < 3 && (
          <>
            <label htmlFor={`${id}-topic`} className="sr-only">Add a topic</label>
            <select
              id={`${id}-topic`}
              value=""
              onChange={(e) => { const t = e.target.value; if (t && !picked.includes(t)) setPicked([...picked, t]); }}
              className={cn(selectPillCls, "h-8 text-xs")}
            >
              <option value="">Add a topic…</option>
              {TOPICS.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.topics.filter((t) => !picked.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("font-mono text-[11px] tabular-nums", text.length > MAX - 100 ? "text-danger" : "text-faint")}>{text.length} / {MAX}</span>
        {error && <span role="alert" className="text-xs text-danger">{error}</span>}
        <Button type="button" variant="ghost" className="ml-auto" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending || !changed || !text.trim()}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}
