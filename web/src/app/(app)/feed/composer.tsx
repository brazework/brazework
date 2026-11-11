"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, AtSign, Check, FlaskConical, FolderGit2, Hash, HelpCircle, ImagePlus, Loader2, Megaphone, PenLine, Plus, Rocket, Square, Undo2, Upload, Users, Video, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, menuCls, menuItemCls } from "@/components/ui";
import { POST_KINDS, cn } from "@/lib/forge";
import { createPost, type ComposeState } from "./actions";
import { AttachmentTray, useAttachments } from "@/components/media/attach";
import { useCopilot } from "@/components/copilot/use-copilot";
import { EmberAnswer, emberActions, useTypedPlaceholder, type EmberAction, type EmberAnswerState } from "@/components/copilot/feed-copilot";
import { Ember } from "@/components/ember/ember";
import { useMentions } from "@/components/mentions/mention-menu";
import { MAX_TAGS, hashtagFor, hashtagParts, hashtagsIn } from "@/lib/hashtags";
import { mentionParts } from "@/lib/mention-text";

const KIND_ICON = { update: Megaphone, question: HelpCircle, result: FlaskConical, project: Rocket } as const;
const MAX = 3000;
const NO_ANSWER: EmberAnswerState = { q: "", text: "", tools: [], proposals: [] };

// The top of the feed: one box to create and to ask. "Post" is the composer (photos and video by
// pick, drop or paste; Ember can polish the draft in place). "Ask Ember" sends the same box to
// Copilot, with answers and confirm cards right underneath.
export function Composer({ first, last, interests, userId, mediaEnabled = false, captionsEnabled = false, avatarSrc, copilot = false, club = null, next = null, mentionsEnabled = false, projects = [], clubs = [], initialProject }: { first: string; last: string; interests: string[]; userId: string; mediaEnabled?: boolean; captionsEnabled?: boolean; avatarSrc?: string | null; copilot?: boolean; club?: { id: string; name: string } | null; next?: { label: string; href: string } | null; projects?: { id: string; title: string }[]; clubs?: { id: string; name: string }[]; initialProject?: string; mentionsEnabled?: boolean }) {
  const [mode, setMode] = useState<"post" | "ask">("post");
  // Posting awaits the action itself rather than going through useActionState: that state only
  // lands when its transition commits, and a response that carries a re-rendered page (a session
  // cookie refreshed mid-action does that) held a saved post as "not posted" (Linear FIX-45).
  const [state, setState] = useState<ComposeState>({ ok: false, message: "", nonce: 0 });
  const [pending, setPending] = useState(false);
  const send = async (form: FormData) => {
    if (pending) return;
    setPending(true);
    try { setState(await createPost(state, form)); }
    catch { setState((s) => ({ ...s, ok: false, message: "Couldn't post. Check your connection and try again." })); }
    finally { setPending(false); }
  };
  const [kind, setKind] = useState<string>("update");
  // Which project it's about comes first (your latest one); "general update" is allowed, not the default.
  const [projectId, setProjectId] = useState<string>(projects.find((p) => p.id === initialProject)?.id ?? projects[0]?.id ?? "");
  const [shareTo, setShareTo] = useState<string>("");
  const [body, setBody] = useState("");
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
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

  // Arriving from Create → Post (/feed#composer): open the box, ready to type.
  // Also when you're already here: Next changes the hash with pushState, which fires no event, so
  // the Create sheet sends "forge:compose" instead.
  useEffect(() => {
    const start = () => requestAnimationFrame(() => { setMode("post"); textRef.current?.focus(); textRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); });
    const raf = location.hash === "#composer" ? start() : 0;
    window.addEventListener("forge:compose", start);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("forge:compose", start); };
  }, []);

  // Clear after a successful post (adjusting state during render, not in an effect), then refresh
  // the page to show it: createPost doesn't revalidate (see there).
  const router = useRouter();
  useEffect(() => { if (state.nonce > 0) router.refresh(); }, [state.nonce, router]);
  const [seenNonce, setSeenNonce] = useState(0);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    setBody("");
    setKind("update");
    setBefore(null);
    att.clear();
    at.reset();
  }

  // The box grows with what you write (up to max-h-80) and shrinks back once it's posted or cleared.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body, question, mode]);

  // Tags are the #tags written in the text (lib/hashtags.ts); more than three, and the rest are greyed.
  const tags = hashtagsIn(body);
  const extraTags = new Set(hashtagParts(body).flatMap((p) => (typeof p === "string" ? [] : [p.tag]))).size - tags.length;
  // The @ and # tools type at the caret (with a space before if needed), then keep typing from there.
  const insert = (s: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? body.length, end = el?.selectionEnd ?? body.length;
    const pre = body.slice(0, start);
    const add = (pre && !/\s$/.test(pre) ? " " : "") + s;
    setBody((pre + add + body.slice(end)).slice(0, MAX));
    setBefore(null);
    requestAnimationFrame(() => { if (!el) return; el.focus(); const c = start + add.length; el.setSelectionRange(c, c); at.track(el); });
  };
  const pickFiles = (files: FileList | File[]) => {
    if (!mediaEnabled || !files.length) return;
    setMode("post");
    void att.add(files);
  };
  const remaining = MAX - body.length;
  const asking = mode === "ask";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => { e.preventDefault(); if (asking) void ask(question); else void send(new FormData(e.currentTarget)); }}
      onDragOver={(e) => { if (mediaEnabled && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!mediaEnabled) return; e.preventDefault(); setDragging(false); pickFiles(e.dataTransfer.files); }}
      className={cn("relative rounded-3xl p-4 transition", asking ? "ai-border shadow-[var(--shadow)]" : "glass-card", dragging && "scale-[1.01]")}
    >
      {!asking && <input type="hidden" name="kind" value={kind} />}
      {!asking && projectId && <input type="hidden" name="project_id" value={projectId} />}
      {!asking && shareTo && <input type="hidden" name="community_id" value={shareTo} />}
      {!asking && <input type="hidden" name="media" value={JSON.stringify(att.media)} />}
      {!asking && at.mentions.length > 0 && <input type="hidden" name="mentions" value={JSON.stringify(at.mentions)} />}
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />

      {/* One row: you (or Ember), the one choice that matters before writing (which project this is
          about), and the orb, which turns this same box into a question for Ember. Everything else
          (media, @, #, post type, audience) is a tool under the box. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
        {asking
          ? <Ember size={40} mood={ai.busy ? "thinking" : answer.text ? "happy" : "idle"} />
          : <span className="rounded-full bg-accent-grad p-[2px]"><Avatar first={first} last={last} size={40} src={avatarSrc} className="border-2 border-surface" /></span>}
        {asking
          ? <p className="min-w-0 text-sm font-medium">Ask Ember <span className="font-normal text-muted">· it checks real Brazework data first</span></p>
          : <ProjectPicker projects={projects} projectId={projectId} setProjectId={setProjectId} />}
        {/* The orb, on the first row's centre line: ask Ember in this same box, and back to writing. */}
        <button type="button" onClick={() => { setMode(asking ? "post" : "ask"); requestAnimationFrame(() => textRef.current?.focus()); }} aria-pressed={asking}
          aria-label={asking ? "Back to writing a post" : "Ask Ember"} title={asking ? "Back to writing a post" : "Ask Ember"}
          className={cn("group grid size-10 place-items-center rounded-2xl transition hover:-translate-y-px active:scale-95", asking ? "nav-tile-on" : "nav-tile")}>
          {asking ? <PenLine className="size-4" /> : <span className="transition duration-300 group-hover:scale-110"><Ember size={26} mood={ai.busy ? "thinking" : "idle"} /></span>}
        </button>
      </div>

      {/* The box itself: always open, three lines to start, growing with what you write. */}
      <label htmlFor="create-box" className="sr-only">{asking ? "Ask Ember" : `What are you building, ${first}?`}</label>
      <div className={cn("relative mt-3 rounded-2xl border transition duration-200", focused ? "border-line-strong bg-surface shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_9%,transparent)]" : "border-line bg-surface/70 hover:border-line-strong")}>
        {/* The words you type, drawn underneath the (transparent) text box so #tags and @mentions can
            carry colour. Same font, padding and wrapping; only colours differ, so the caret lines up. */}
        {!asking && (
          <div ref={mirrorRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-3 text-[16px] leading-relaxed break-words whitespace-pre-wrap text-text">
            {mentionParts(body, at.mentions).map((p, i) =>
              typeof p === "string"
                ? hashtagParts(p).map((h, j) => typeof h === "string" ? h : <span key={`${i}-${j}`} className={tags.includes(h.tag) ? "text-[var(--tag)]" : "text-faint"}>{h.written}</span>)
                : <span key={i} className="rounded-[3px] bg-[color-mix(in_oklab,var(--text)_9%,transparent)]">@{p.name}</span>)}
            {"\n "}
          </div>
        )}
        <textarea
          id="create-box"
          ref={textRef}
          name={asking ? undefined : "body"}
          value={asking ? question : body}
          onChange={(e) => { if (asking) { setQuestion(e.target.value); setSoon(false); } else { setBody(e.target.value); setBefore(null); at.track(e.target); } }}
          onSelect={(e) => { if (!asking) at.track(e.currentTarget); }}
          {...(asking ? {} : at.inputProps)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); at.close(); }}
          onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.length && mediaEnabled) { e.preventDefault(); pickFiles(files); } }}
          onKeyDown={(e) => {
            if (!asking && at.onKeyDown(e)) return;
            if (asking && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(question); }
            if (!asking && (e.metaKey || e.ctrlKey) && e.key === "Enter") formRef.current?.requestSubmit();
          }}
          maxLength={asking ? 4000 : MAX}
          rows={asking ? 2 : 3}
          placeholder={asking ? typed || "Ask Ember anything" : mentionsEnabled ? `What are you building, ${first}? Type @ to mention someone.` : `What are you building, ${first}?`}
          onScroll={(e) => { if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop; }}
          style={{ outline: "none" }}
          className={cn("relative block max-h-80 w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-relaxed placeholder:text-faint", asking ? "min-h-[4.5rem] pr-14 text-text" : "no-scrollbar min-h-[6rem] text-transparent caret-[var(--text)] selection:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)]")}
        />
        {!asking && at.menu}
        {asking && (
          <div className="absolute right-2 bottom-2">
            {ai.busy
              ? <button type="button" onClick={ai.stop} aria-label="Stop" className="grid size-9 place-items-center rounded-xl border border-line bg-surface"><Square className="size-3.5 fill-current" /></button>
              : <button type="submit" disabled={!question.trim()} aria-label="Ask Ember" className="bg-accent-grad grid size-9 place-items-center rounded-xl text-on-accent transition active:scale-90 disabled:opacity-40"><ArrowUp className="size-4" /></button>}
          </div>
        )}
      </div>

      {/* Ask Ember: one-tap starts, then the answer. */}
      {asking && (
        <>
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {emberActions(club).map((a) => {
              const cls = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs font-medium text-text-2 transition hover:-translate-y-px hover:border-line-strong hover:text-text active:scale-95";
              return copilot
                ? <button key={a.label} type="button" onClick={() => pickAction(a)} className={cls}><a.icon className="size-3.5 text-accent" /> {a.label}</button>
                : <Link key={a.label} href={a.href} className={cls}><a.icon className="size-3.5 text-accent" /> {a.label}</Link>;
            })}
          </div>
          {soon && <p className="mt-2 text-xs text-muted">Ember is waking up soon. Until then, these shortcuts take you to the right place.</p>}
          <EmberAnswer a={answer} busy={ai.busy} error={ai.error} remaining={ai.remaining} onClear={() => { ai.stop(); setAnswer(NO_ANSWER); }} />
        </>
      )}

      {/* Posting: what you've attached, then one toolbar (add media, polish with Ember, post). */}
      {!asking && (
        <>
          {extraTags > 0 && <p className="mt-1.5 px-1 text-[11px] text-faint">Only the first {MAX_TAGS} tags count; the grey ones won&apos;t be added.</p>}
          {mediaEnabled && <AttachmentTray slots={att.slots} onRemove={att.remove} onEdit={att.edit} compare={att.compare} onCompare={att.setCompare} captions={captionsEnabled} />}
          {/* The tools, in one row that fits a phone: icons there, names on wider screens. */}
          <div className="mt-2.5 flex items-center gap-0.5">
            <IconTool label="Add a photo" disabled={!mediaEnabled || att.full} onClick={() => photoRef.current?.click()}><ImagePlus className="size-[18px]" /></IconTool>
            <IconTool label="Add a video" disabled={!mediaEnabled || att.full} onClick={() => videoRef.current?.click()}><Video className="size-[18px]" /></IconTool>
            {mentionsEnabled && <IconTool label="Mention someone" onClick={() => insert("@")}><AtSign className="size-[18px]" /></IconTool>}
            <TagTool interests={interests} tags={tags} onPick={(t) => insert(`${t} `)} />
            <KindMenu kind={kind} setKind={setKind} />
            {clubs.length > 0 && <AudienceTool clubs={clubs} shareTo={shareTo} setShareTo={setShareTo} />}
            {copilot && (ai.busy
              ? <button type="button" onClick={ai.stop} aria-label="Stop polishing" className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm text-muted"><Loader2 className="size-4 animate-spin" /><span className="hidden sm:inline">Polishing…</span></button>
              : before !== null
                ? <button type="button" onClick={() => { setBody(before); setBefore(null); }} aria-label="Undo polish" className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm text-muted hover:bg-hover hover:text-text"><Undo2 className="size-4" /><span className="hidden sm:inline">Undo polish</span></button>
                : <button type="button" onClick={() => void polish()} disabled={!body.trim()} aria-label="Polish with Ember" title="Polish with Ember" className="ai-chip inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-text-2 transition hover:text-text active:scale-95 disabled:pointer-events-none disabled:opacity-40"><Wand2 className="size-4 text-accent" /><span className="hidden sm:inline">Polish</span></button>)}
            <span className="ml-auto flex shrink-0 items-center gap-2.5">
              <span className="hidden sm:block"><CharRing used={body.length} max={MAX} /></span>
              {remaining <= 200 && <span className={cn("text-xs tabular-nums", remaining < 0 ? "text-danger" : "text-faint")}>{remaining}</span>}
              {(body || att.slots.length > 0) && <button type="button" onClick={() => { setBody(""); setBefore(null); att.clear(); at.reset(); }} className="hidden text-sm text-muted transition hover:text-text sm:block">Clear</button>}
              <Button type="submit" disabled={pending || att.busy || ai.busy || !body.trim()}>
                {pending && <Loader2 className="size-4 animate-spin" />} Post
              </Button>
            </span>
          </div>
          {(att.error || state.message || ai.error) && <p role="alert" className="mt-2 px-1 text-sm text-danger">{att.error || state.message || ai.error}</p>}
          {next && !body && <Link href={next.href} className="mt-2 inline-flex items-center gap-1 rounded-full text-[11px] text-muted transition hover:text-text">Next: {next.label} <ArrowRight className="size-3" /></Link>}
        </>
      )}

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

// A small icon button in the composer (photo, video), with its name for screen readers and on hover.
function IconTool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid size-9 place-items-center rounded-full transition hover:bg-hover active:scale-90 disabled:pointer-events-none disabled:opacity-40">
      {children}
    </button>
  );
}

// A tool that opens a small menu (post type, tags); Escape or a click outside closes it. Icon-only
// on a phone, with its name beside the icon on wider screens.
const TOOL = "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm text-text-2 transition hover:bg-hover hover:text-text active:scale-95";
function ToolMenu({ icon, name, label, children, width = 224 }: { icon: React.ReactNode; name?: React.ReactNode; label: string; children: (close: () => void) => React.ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  // Where the menu sits: under the tool, slid left or right just enough to stay 16px inside the screen.
  const [place, setPlace] = useState({ left: 0, width });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="true"
        onClick={() => {
          const r = box.current?.getBoundingClientRect();
          if (r) { const w = Math.min(width, innerWidth - 32); setPlace({ width: w, left: Math.max(16 - r.left, Math.min(0, innerWidth - 16 - w - r.left)) }); }
          setOpen(!open);
        }}
        className={cn(TOOL, open && "bg-hover text-text")}>
        {icon}{name && <span className="hidden max-w-[9rem] truncate sm:inline">{name}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.14 }}
            style={place} className={cn(menuCls, "absolute top-full z-40 mt-1.5")}>
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// What kind of post: update, question, result or project.
function KindMenu({ kind, setKind }: { kind: string; setKind: (k: string) => void }) {
  const current = POST_KINDS.find((k) => k.id === kind) ?? POST_KINDS[0];
  const Icon = KIND_ICON[current.id as keyof typeof KIND_ICON];
  return (
    <ToolMenu icon={<Icon className="size-[18px] shrink-0" />} name={current.label} label={`Post type: ${current.label}`} width={176}>
      {(close) => (
        <div role="radiogroup" aria-label="Post type" className="flex flex-col">
          {POST_KINDS.map((k) => {
            const KIcon = KIND_ICON[k.id as keyof typeof KIND_ICON];
            const on = k.id === kind;
            return (
              <button key={k.id} type="button" role="radio" aria-checked={on} onClick={() => { setKind(k.id); close(); }} className={cn(menuItemCls, on && "bg-hover text-text")}>
                <KIcon className="size-4" /> {k.label}{on && <Check className="ml-auto size-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </ToolMenu>
  );
}

// Tags: type #anything to make your own; this menu starts one, or adds one of your interests.
function TagTool({ interests, tags, onPick }: { interests: string[]; tags: string[]; onPick: (written: string) => void }) {
  const full = tags.length >= MAX_TAGS;
  return (
    <ToolMenu icon={<Hash className={cn("size-[18px] shrink-0", tags.length > 0 && "text-[var(--tag)]")} />} name={tags.length ? `${tags.length}/${MAX_TAGS}` : undefined} label={`Tags (${tags.length} of ${MAX_TAGS})`} width={288}>
      {(close) => (
        <div className="p-1.5">
          <button type="button" disabled={full} onClick={() => { onPick("#"); close(); }} className={cn(menuItemCls, "w-full disabled:opacity-40")}>
            <Plus className="size-4" /> New tag <span className="ml-auto text-xs text-faint">type #anything</span>
          </button>
          {interests.length > 0 && (
            <>
              <p className="px-2 pt-2 pb-1.5 text-[11px] text-faint">Your interests</p>
              <div className="flex flex-wrap gap-1.5 px-1">
                {interests.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button key={t} type="button" disabled={on || full} onClick={() => { onPick(hashtagFor(t)); close(); }}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-[var(--tag)] transition hover:border-line-strong disabled:opacity-40">
                      {hashtagFor(t)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="px-2 pt-2.5 text-[11px] text-faint">Up to {MAX_TAGS}, so the right people find it.</p>
        </div>
      )}
    </ToolMenu>
  );
}

// Who sees it: your feed, or also one of your clubs (so the club sees work it may verify). A real
// select under the icon, so a phone opens its own picker.
function AudienceTool({ clubs, shareTo, setShareTo }: { clubs: { id: string; name: string }[]; shareTo: string; setShareTo: (v: string) => void }) {
  const club = clubs.find((c) => c.id === shareTo);
  return (
    <span className={cn(TOOL, "relative", club && "text-text")}>
      <Users className="size-[18px] shrink-0" />
      <span className="hidden max-w-[9rem] truncate sm:inline">{club ? club.name : "Your feed"}</span>
      {club && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-ok sm:hidden" />}
      <label className="sr-only" htmlFor="compose-club">Also share with</label>
      <select id="compose-club" value={shareTo} onChange={(e) => setShareTo(e.target.value)} title="Also share with a club" className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">Your feed</option>
        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </span>
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

// "Which project is this about?": the one choice before writing, as a full-width pill.
function ProjectPicker({ projects, projectId, setProjectId }: { projects: { id: string; title: string }[]; projectId: string; setProjectId: (v: string) => void }) {
  if (!projects.length) {
    return <Link href="/profile#projects" className="inline-flex h-9 max-w-max items-center gap-1 rounded-full border border-dashed border-line px-3.5 text-sm text-muted transition hover:border-line-strong hover:text-text">+ Add the project you&apos;re building</Link>;
  }
  return (
    <span className="relative flex min-w-0 sm:max-w-sm">
      <label className="sr-only" htmlFor="compose-project">Which project?</label>
      <FolderGit2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
      <select id="compose-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} title="Which project?"
        className="h-10 w-full min-w-0 appearance-none truncate rounded-full border border-line bg-surface pr-9 pl-10 text-sm font-medium text-text transition hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        <option value="">General update (no project)</option>
      </select>
    </span>
  );
}
