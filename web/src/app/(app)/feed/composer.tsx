"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, FlaskConical, HelpCircle, ImagePlus, Loader2, Megaphone, PenLine, Rocket, Square, Undo2, Upload, Video, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { POST_KINDS, cn } from "@/lib/forge";
import { createPost, type ComposeState } from "./actions";
import { submitWithoutReset } from "@/lib/submit";
import { AttachmentTray, useAttachments } from "@/components/media/attach";
import { useCopilot } from "@/components/copilot/use-copilot";
import { EmberAnswer, emberActions, useTypedPlaceholder, type EmberAction, type EmberAnswerState } from "@/components/copilot/feed-copilot";
import { Ember } from "@/components/ember/ember";
import { useMentions } from "@/components/mentions/mention-menu";

const KIND_ICON = { update: Megaphone, question: HelpCircle, result: FlaskConical, project: Rocket } as const;
const MAX = 3000;
const NO_ANSWER: EmberAnswerState = { q: "", text: "", tools: [], proposals: [] };

// The top of the feed: one box to create and to ask. "Post" is the composer (photos and video by
// pick, drop or paste; Ember can polish the draft in place). "Ask Ember" sends the same box to
// Copilot, with answers and confirm cards right underneath.
export function Composer({ first, last, interests, userId, mediaEnabled = false, avatarSrc, copilot = false, club = null, next = null, mentionsEnabled = false }: { first: string; last: string; interests: string[]; userId: string; mediaEnabled?: boolean; avatarSrc?: string | null; copilot?: boolean; club?: { id: string; name: string } | null; next?: { label: string; href: string } | null; mentionsEnabled?: boolean }) {
  const [mode, setMode] = useState<"post" | "ask">("post");
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
  const ai = useCopilot();
  const at = useMentions({ text: body, setText: (v) => { setBody(v.slice(0, MAX)); setBefore(null); }, ref: textRef, enabled: mentionsEnabled });

  // Ask Ember.
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<EmberAnswerState>(NO_ANSWER);
  const [soon, setSoon] = useState(false);
  const [focused, setFocused] = useState(false);
  const typed = useTypedPlaceholder(mode === "ask" && !question && !focused && !answer.q);
  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || ai.busy) return;
    if (!copilot) { setSoon(true); return; }
    setQuestion("");
    setAnswer({ ...NO_ANSWER, q: t });
    await ai.run({ task: "ask", input: t }, (full, tools, proposals) => setAnswer({ q: t, text: full, tools, proposals }));
  };
  const pickAction = (a: EmberAction) => {
    if (a.ask) void ask(a.ask);
    else if (a.prefill) { setQuestion(a.prefill); requestAnimationFrame(() => { textRef.current?.focus(); textRef.current?.setSelectionRange(a.prefill!.length, a.prefill!.length); }); }
  };

  // Polish with Ember: rewrites the draft in place; Undo brings the original back.
  const [before, setBefore] = useState<string | null>(null);
  const polish = async () => {
    if (!body.trim() || ai.busy) return;
    const original = body;
    setBefore(original);
    const out = await ai.run({ task: "post", input: original, kind: kind as "update" | "question" | "result" | "project" }, (full) => setBody(full.slice(0, MAX)));
    if (out === null) { setBody(original); setBefore(null); }
  };

  // Clear after a successful post (adjusting state during render, not in an effect).
  const [seenNonce, setSeenNonce] = useState(0);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    setBody("");
    setTags([]);
    setKind("update");
    setOpen(false);
    setBefore(null);
    att.clear();
    at.reset();
  }

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 ? [...cur, t] : cur));
  const expand = (k?: string) => {
    if (k) setKind(k);
    setOpen(true);
    requestAnimationFrame(() => textRef.current?.focus());
  };
  const pickFiles = (files: FileList | File[]) => {
    if (!mediaEnabled || !files.length) return;
    setMode("post");
    setOpen(true);
    void att.add(files);
  };
  const remaining = MAX - body.length;
  const asking = mode === "ask";

  return (
    <form
      ref={formRef}
      onSubmit={asking ? (e) => { e.preventDefault(); void ask(question); } : submitWithoutReset(action)}
      onDragOver={(e) => { if (mediaEnabled && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!mediaEnabled) return; e.preventDefault(); setDragging(false); pickFiles(e.dataTransfer.files); }}
      className={cn("relative rounded-3xl p-4 transition", asking ? "ai-border shadow-[var(--shadow)]" : "glass-card", dragging && "scale-[1.01]")}
    >
      {!asking && <input type="hidden" name="kind" value={kind} />}
      {!asking && tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
      {!asking && <input type="hidden" name="media" value={JSON.stringify(att.media)} />}
      {!asking && at.mentions.length > 0 && <input type="hidden" name="mentions" value={JSON.stringify(at.mentions)} />}
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />

      {/* Post or Ask Ember. */}
      <div className="mb-3 flex items-center gap-2">
        <div role="tablist" aria-label="Create or ask" className="inline-flex rounded-full bg-surface-2 p-1">
          {([["post", "Post", null], ["ask", "Ask Ember", "ember"]] as const).map(([id, label, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => { setMode(id); requestAnimationFrame(() => textRef.current?.focus()); }} className={cn("relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition", mode === id ? "text-on-accent" : "text-muted hover:text-text")}>
              {mode === id && <motion.span layoutId="compose-mode" className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              {icon ? <Ember size={18} mood={ai.busy ? "thinking" : "idle"} className="relative" /> : <PenLine className="relative size-3.5" />}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        {next && <Link href={next.href} className="ml-auto hidden items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-text-2 transition hover:border-line-strong sm:inline-flex">Next: {next.label} <ArrowRight className="size-3" /></Link>}
      </div>

      <div className="flex gap-3">
        {asking
          ? <Ember size={42} mood={ai.busy ? "thinking" : answer.text ? "happy" : "idle"} className="mt-0.5" />
          : <span className="h-fit rounded-full bg-accent-grad p-[2px]"><Avatar first={first} last={last} size={40} src={avatarSrc} className="border-2 border-surface" /></span>}
        <label htmlFor="create-box" className="sr-only">{asking ? "Ask Ember" : `What are you building, ${first}?`}</label>
        <div className="relative flex min-w-0 flex-1">
        <textarea
          id="create-box"
          ref={textRef}
          name={asking ? undefined : "body"}
          value={asking ? question : body}
          onChange={(e) => { if (asking) { setQuestion(e.target.value); setSoon(false); } else { setBody(e.target.value); setBefore(null); at.track(e.target); } }}
          onSelect={(e) => { if (!asking) at.track(e.currentTarget); }}
          {...(asking ? {} : at.inputProps)}
          onFocus={() => { setFocused(true); if (!asking) setOpen(true); }}
          onBlur={() => { setFocused(false); at.close(); }}
          onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.length && mediaEnabled) { e.preventDefault(); pickFiles(files); } }}
          onKeyDown={(e) => {
            if (!asking && at.onKeyDown(e)) return;
            if (asking && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(question); }
            if (!asking && (e.metaKey || e.ctrlKey) && e.key === "Enter") formRef.current?.requestSubmit();
          }}
          maxLength={asking ? 4000 : MAX}
          rows={!asking && open ? 4 : 1}
          placeholder={asking ? typed || "Ask Ember anything" : mentionsEnabled && open ? "Share what you built. Type @ to mention someone." : `What are you building, ${first}?`}
          // A hairline ring instead of the global focus outline (which out-ranks Tailwind's outline-none).
          style={{ outline: "none" }}
          className="min-h-11 flex-1 resize-none rounded-2xl bg-surface-2/60 px-4 py-2.5 text-[15px] leading-relaxed text-text transition placeholder:text-faint focus:bg-transparent focus:ring-1 focus:ring-line-strong"
        />
        {!asking && at.menu}
        </div>
        {asking && (ai.busy
          ? <button type="button" onClick={ai.stop} aria-label="Stop" className="grid size-11 shrink-0 place-items-center rounded-xl border border-line"><Square className="size-4 fill-current" /></button>
          : <button type="submit" disabled={!question.trim()} aria-label="Ask Ember" className="bg-accent-grad grid size-11 shrink-0 place-items-center rounded-xl text-on-accent transition active:scale-90 disabled:opacity-40"><ArrowUp className="size-5" /></button>)}
      </div>

      {/* Ask Ember: one-tap actions, then the answer. */}
      {asking && (
        <>
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 pl-[54px]">
            {emberActions(club).map((a) => {
              const cls = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs font-medium text-text-2 transition hover:-translate-y-px hover:border-line-strong hover:text-text active:scale-95";
              return copilot
                ? <button key={a.label} type="button" onClick={() => pickAction(a)} className={cls}><a.icon className="size-3.5 text-accent" /> {a.label}</button>
                : <Link key={a.label} href={a.href} className={cls}><a.icon className="size-3.5 text-accent" /> {a.label}</Link>;
            })}
          </div>
          {soon && <p className="mt-2 pl-[54px] text-xs text-muted">Ember is waking up soon. Until then, these shortcuts take you to the right place.</p>}
          <EmberAnswer a={answer} busy={ai.busy} error={ai.error} remaining={ai.remaining} onClear={() => { ai.stop(); setAnswer(NO_ANSWER); }} />
        </>
      )}

      {/* Post: shortcuts while collapsed, the full editor once open. */}
      {!asking && !open && (
        <div className="mt-3 flex flex-wrap gap-1 pl-[52px]">
          <Quick icon={ImagePlus} label="Photo" tint="text-sky-500" disabled={!mediaEnabled} onClick={() => photoRef.current?.click()} />
          <Quick icon={Video} label="Video" tint="text-rose-500" disabled={!mediaEnabled} onClick={() => videoRef.current?.click()} />
          <Quick icon={FlaskConical} label="Result" tint="text-emerald-500" onClick={() => expand("result")} />
          <Quick icon={HelpCircle} label="Question" tint="text-amber-500" onClick={() => expand("question")} />
          {!mediaEnabled && <span className="self-center text-[11px] text-faint">Photo and video are switching on soon</span>}
        </div>
      )}

      <AnimatePresence initial={false}>
        {!asking && open && (
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
              {copilot && (ai.busy
                ? <button type="button" onClick={ai.stop} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Polishing…</button>
                : before !== null
                  ? <button type="button" onClick={() => { setBody(before); setBefore(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-hover hover:text-text"><Undo2 className="size-4" /> Undo polish</button>
                  : <Quick icon={Wand2} label="Polish with Ember" tint="text-accent" disabled={!body.trim()} onClick={() => void polish()} />)}
              {(att.error || state.message || ai.error) && <p role="alert" className="text-sm text-danger">{att.error || state.message || ai.error}</p>}
              <span className="ml-auto flex items-center gap-3">
                <CharRing used={body.length} max={MAX} />
                {remaining <= 200 && <span className={cn("text-xs tabular-nums", remaining < 0 ? "text-danger" : "text-faint")}>{remaining}</span>}
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted transition hover:text-text">Cancel</button>
                <Button type="submit" disabled={pending || att.busy || ai.busy || !body.trim()}>
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
