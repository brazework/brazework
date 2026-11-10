"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, Check, ChevronDown, FlaskConical, FolderGit2, Hash, HelpCircle, ImagePlus, Loader2, Megaphone, PenLine, Rocket, Square, Undo2, Upload, Users, Video, Wand2, X } from "lucide-react";
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

  // Arriving from Create → Post (/feed#composer): open the box, ready to type.
  // Also when you're already here: Next changes the hash with pushState, which fires no event, so
  // the Create sheet sends "forge:compose" instead.
  useEffect(() => {
    const start = () => requestAnimationFrame(() => { setMode("post"); setOpen(true); textRef.current?.focus(); textRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); });
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
    setTags([]);
    setKind("update");
    setOpen(false);
    setBefore(null);
    att.clear();
    at.reset();
  }

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 ? [...cur, t] : cur));
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
      onSubmit={(e) => { e.preventDefault(); if (asking) void ask(question); else void send(new FormData(e.currentTarget)); }}
      onDragOver={(e) => { if (mediaEnabled && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (!mediaEnabled) return; e.preventDefault(); setDragging(false); pickFiles(e.dataTransfer.files); }}
      className={cn("relative rounded-3xl p-4 transition", asking ? "ai-border shadow-[var(--shadow)]" : "glass-card", dragging && "scale-[1.01]")}
    >
      {!asking && <input type="hidden" name="kind" value={kind} />}
      {!asking && projectId && <input type="hidden" name="project_id" value={projectId} />}
      {!asking && shareTo && <input type="hidden" name="community_id" value={shareTo} />}
      {!asking && tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
      {!asking && <input type="hidden" name="media" value={JSON.stringify(att.media)} />}
      {!asking && at.mentions.length > 0 && <input type="hidden" name="mentions" value={JSON.stringify(at.mentions)} />}
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { if (e.target.files) pickFiles(e.target.files); e.target.value = ""; }} />

      {/* One box: write a post, or tap the orb to ask Ember in the same place. */}
      <div className="flex items-start gap-3">
        {asking
          ? <Ember size={40} mood={ai.busy ? "thinking" : answer.text ? "happy" : "idle"} className="mt-0.5" />
          : <span className="h-fit rounded-full bg-accent-grad p-[2px]"><Avatar first={first} last={last} size={40} src={avatarSrc} className="border-2 border-surface" /></span>}
        <label htmlFor="create-box" className="sr-only">{asking ? "Ask Ember" : `What are you building, ${first}?`}</label>
        <div className={cn("relative flex min-w-0 flex-1 items-end rounded-2xl border transition", focused || open || asking ? "border-line-strong bg-surface" : "border-transparent bg-surface-2/70 hover:bg-surface-2")}>
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
            rows={!asking && open ? 3 : 1}
            placeholder={asking ? typed || "Ask Ember anything" : mentionsEnabled && open ? "Share what you built. Type @ to mention someone." : `What are you building, ${first}?`}
            style={{ outline: "none" }}
            className="max-h-72 min-h-11 flex-1 resize-none bg-transparent px-4 py-2.5 text-[15px] leading-relaxed text-text placeholder:text-faint"
          />
          {!asking && at.menu}
          {/* Closed: add a photo or video straight from the box (from a tablet up; on a phone the box
              gets the room, and the same buttons are in its footer once it opens). */}
          {!asking && !open && mediaEnabled && (
            <div className="hidden shrink-0 items-center gap-0.5 p-1 sm:flex">
              <IconTool label="Add a photo" onClick={() => photoRef.current?.click()}><ImagePlus className="size-[18px] text-sky-500" /></IconTool>
              <IconTool label="Add a video" onClick={() => videoRef.current?.click()}><Video className="size-[18px] text-rose-500" /></IconTool>
            </div>
          )}
          {asking && (
            <div className="p-1">
              {ai.busy
                ? <button type="button" onClick={ai.stop} aria-label="Stop" className="grid size-9 place-items-center rounded-xl border border-line"><Square className="size-3.5 fill-current" /></button>
                : <button type="submit" disabled={!question.trim()} aria-label="Ask Ember" className="bg-accent-grad grid size-9 place-items-center rounded-xl text-on-accent transition active:scale-90 disabled:opacity-40"><ArrowUp className="size-4" /></button>}
            </div>
          )}
        </div>
        {/* The orb: ask Ember in this same box, and back to writing. */}
        <button type="button" onClick={() => { setMode(asking ? "post" : "ask"); requestAnimationFrame(() => textRef.current?.focus()); }} aria-pressed={asking}
          aria-label={asking ? "Back to writing a post" : "Ask Ember"} title={asking ? "Back to writing a post" : "Ask Ember"}
          className={cn("group grid size-11 shrink-0 place-items-center rounded-2xl transition hover:-translate-y-px", asking ? "nav-tile-on" : "nav-tile")}>
          {asking ? <PenLine className="size-4" /> : <span className="transition duration-300 group-hover:scale-110"><Ember size={26} mood={ai.busy ? "thinking" : "idle"} /></span>}
        </button>
      </div>

      {/* Ask Ember: one-tap starts, then the answer. */}
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

      {/* Where it goes and what it is: one quiet row of chips (type and tags appear once you start). */}
      {!asking && (
        <div className={cn("mt-2.5 flex-wrap items-center gap-1.5 pl-[52px]", open ? "flex" : "hidden sm:flex")}>
          <ProjectPicker projects={projects} clubs={clubs} projectId={projectId} setProjectId={setProjectId} shareTo={shareTo} setShareTo={setShareTo} />
          {open && <KindMenu kind={kind} setKind={setKind} />}
          {open && interests.length > 0 && <TagsMenu interests={interests} tags={tags} toggle={toggleTag} />}
          {next && !open && <Link href={next.href} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted transition hover:bg-hover hover:text-text">Next: {next.label} <ArrowRight className="size-3" /></Link>}
        </div>
      )}

      <AnimatePresence initial={false}>
        {!asking && open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            {mediaEnabled && <div className="pl-[52px]"><AttachmentTray slots={att.slots} onRemove={att.remove} onEdit={att.edit} compare={att.compare} onCompare={att.setCompare} captions={captionsEnabled} /></div>}
            <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3 sm:pl-[52px]">
              <IconTool label="Add a photo" disabled={!mediaEnabled || att.full} onClick={() => photoRef.current?.click()}><ImagePlus className="size-[18px] text-sky-500" /></IconTool>
              <IconTool label="Add a video" disabled={!mediaEnabled || att.full} onClick={() => videoRef.current?.click()}><Video className="size-[18px] text-rose-500" /></IconTool>
              {copilot && (ai.busy
                ? <button type="button" onClick={ai.stop} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Polishing…</button>
                : before !== null
                  ? <button type="button" onClick={() => { setBody(before); setBefore(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-hover hover:text-text"><Undo2 className="size-4" /> Undo polish</button>
                  : <button type="button" onClick={() => void polish()} disabled={!body.trim()} className="ai-chip inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-text-2 transition hover:text-text active:scale-95 disabled:pointer-events-none disabled:opacity-40"><Wand2 className="size-4 text-accent" /> Polish with Ember</button>)}
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

// A small icon button in the composer (photo, video), with its name for screen readers and on hover.
function IconTool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid size-9 place-items-center rounded-full transition hover:bg-hover active:scale-90 disabled:pointer-events-none disabled:opacity-40">
      {children}
    </button>
  );
}

// A compact chip that opens a small menu under it; Escape or a click outside closes it.
const CHIP = "inline-flex h-8 max-w-[13rem] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-text-2 transition hover:border-line-strong hover:text-text";
function ChipMenu({ label, children, width = "w-56" }: { label: React.ReactNode; children: (close: () => void) => React.ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
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
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true" className={cn(CHIP, open && "border-line-strong text-text")}>
        {label}<ChevronDown className={cn("size-3 shrink-0 text-faint transition", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.14 }}
            className={cn(menuCls, "absolute top-full left-0 z-40 mt-1.5", width)}>
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// What kind of post: one chip instead of a row of four.
function KindMenu({ kind, setKind }: { kind: string; setKind: (k: string) => void }) {
  const current = POST_KINDS.find((k) => k.id === kind) ?? POST_KINDS[0];
  const Icon = KIND_ICON[current.id as keyof typeof KIND_ICON];
  return (
    <ChipMenu label={<><Icon className="size-3.5 shrink-0" /><span className="truncate">{current.label}</span></>} width="w-44">
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
    </ChipMenu>
  );
}

// Topics: one chip that shows what's picked, with the choices in a menu (instead of a wall of tags).
function TagsMenu({ interests, tags, toggle }: { interests: string[]; tags: string[]; toggle: (t: string) => void }) {
  const label = tags.length ? <><Hash className="size-3.5 shrink-0" /><span className="truncate">{tags[0]}</span>{tags.length > 1 && <span className="text-faint">+{tags.length - 1}</span>}</> : <><Hash className="size-3.5 shrink-0" /> Topics</>;
  return (
    <ChipMenu label={label} width="w-72">
      {() => (
        <div className="p-1.5">
          <p className="px-1 pb-2 text-[11px] text-faint">Up to 3, so the right people find it.</p>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((t) => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" onClick={() => toggle(t)} aria-pressed={on} disabled={!on && tags.length >= 3}
                  className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-40", on ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-muted hover:border-line-strong hover:text-text")}>
                  #{t} {on && <X className="size-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ChipMenu>
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

// "Which project?" then, optionally, a club to share it with (so the club sees the work it may verify).
function ProjectPicker({ projects, clubs, projectId, setProjectId, shareTo, setShareTo }: {
  projects: { id: string; title: string }[]; clubs: { id: string; name: string }[];
  projectId: string; setProjectId: (v: string) => void; shareTo: string; setShareTo: (v: string) => void;
}) {
  const pill = "h-8 max-w-[12rem] truncate rounded-full border border-line bg-surface pl-8 text-xs text-text-2 transition hover:border-line-strong hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  const icon = "pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint";
  if (!projects.length) {
    return <Link href="/profile#projects" className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs text-muted transition hover:border-line-strong hover:text-text">+ Add the project you&apos;re building</Link>;
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor="compose-project">Which project?</label>
      <span className="relative inline-flex">
        <FolderGit2 className={icon} />
        <select id="compose-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={pill} title="Which project?">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          <option value="">General update (no project)</option>
        </select>
      </span>
      {clubs.length > 0 && (
        <>
          <label className="sr-only" htmlFor="compose-club">Also share with</label>
          <span className="relative inline-flex">
            <Users className={icon} />
            <select id="compose-club" value={shareTo} onChange={(e) => setShareTo(e.target.value)} className={pill} title="Also share with a club">
              <option value="">Your feed</option>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </span>
        </>
      )}
    </div>
  );
}
