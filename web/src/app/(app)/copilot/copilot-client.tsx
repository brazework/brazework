"use client";
import { AnimatePresence, motion } from "motion/react";
import type { Preset } from "@/lib/copilot-presets";
import { ArrowRight, BadgeCheck, CalendarCheck, CalendarDays, Check, Compass, Copy, CornerDownRight, FileText, GitBranch, History, Loader2, Megaphone, Plus, ScrollText, Search, ShieldCheck, ThumbsDown, ThumbsUp, Trash2, Users, Waypoints, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCopilot } from "@/components/copilot/use-copilot";
import { cn } from "@/lib/forge";
import { TOOL_LABEL, type Proposal } from "@/lib/copilot-agent";
import { Ember } from "@/components/ember/ember";
import { EmberComposer, type ComposerAction } from "@/components/copilot/composer";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { LinkCards } from "@/components/copilot/link-cards";
import { forgeLinks, splitNext } from "@/lib/copilot-text";
import { emberActions, emberGreeting, type EmberAction } from "@/lib/ember-actions";
import type { NextStep } from "@/lib/ember-record";
import { deleteAllChats, deleteChat, loadChat, rateAnswer, saveChat, type ChatSummary, type SavedMsg } from "@/lib/copilot-chats";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[]; cards?: string[]; next?: string[] };

// What a card Ember prepared is called once the chat is saved (saved chats keep a label, never a
// live card that could be confirmed twice).
const CARD_LABEL: Record<Proposal["kind"], string> = { post: "a post", milestone: "a milestone to verify", signature: "an ask to sign", join: "joining a club", follow: "a follow", event: "a club event", club_post: "a club post", project: "a project", review: "a milestone review", rsvp: "an RSVP", message: "a message", project_edit: "a project update", teammate: "a teammate", invite: "a club invite" };
const toSaved = (m: Msg): SavedMsg => ({ role: m.role, content: m.content, tools: m.tools, cards: [...(m.cards ?? []), ...(m.proposals ?? []).map((p) => CARD_LABEL[p.kind])] });
const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return d < 1 ? "Today" : d < 2 ? "Yesterday" : d < 7 ? `${Math.floor(d)} days ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// The orb, front and centre, with a greeting: the empty state of the chat and the waiting state.
function Hero({ title, sub, mood = "idle" }: { title: string; sub: string; mood?: "idle" | "thinking" | "happy" | "sleepy" }) {
  return (
    <header className="flex flex-col items-center pt-2 text-center sm:pt-8">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <Ember size={72} mood={mood} label="Ember, your Brazework assistant" />
      </motion.div>
      <h1 className="mt-4 text-[1.7rem] leading-tight font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted">{sub}</p>
    </header>
  );
}

const CAPS = [
  { icon: Compass, title: "Find and join", body: "Finds the clubs, events and people that fit you, then joins, RSVPs, follows or messages for you once you tap OK." },
  { icon: GitBranch, title: "Build your record", body: "Imports your GitHub projects, writes them up from the README, and asks your club to verify milestones." },
  { icon: Megaphone, title: "Run your club", body: "Weekly reports, the verification queue, events and club updates, posted to your club on Brazework." },
];

// Shown until Copilot is switched on (an API key plus supabase/copilot.sql). Shortcuts still work.
export function CopilotSoon() {
  return (
    <>
      <Hero title="Ember is almost here" sub="Your AI teammate on Brazework. It looks things up, then gets things done with your OK:" mood="sleepy" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CAPS.map((c, i) => (
          <motion.div key={c.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="glass-card rounded-3xl p-5">
            <span className="nav-tile grid size-10 place-items-center rounded-xl text-text-2"><c.icon className="size-5" /></span>
            <h2 className="mt-4 font-semibold">{c.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
          </motion.div>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-center text-xs font-medium tracking-wide text-faint uppercase">Meanwhile</h2>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {[[Search, "Search Brazework", "/search"], [Users, "Find clubs", "/communities?tab=discover"], [CalendarDays, "Events this week", "/events"], [FileText, "Add a project", "/profile#projects"]].map(([Icon, label, href]) => {
            const I = Icon as typeof Search;
            return <Link key={label as string} href={href as string} className="glass-card inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-text-2 transition hover:text-text"><I className="size-4" /> {label as string} <ArrowRight className="size-3.5 text-faint" /></Link>;
          })}
        </div>
      </section>
    </>
  );
}

// Links Copilot gives (/c/…, /events/…, /u/…) become real links; everything else stays text.
export function Rich({ text: raw }: { text: string }) {
  const text = splitNext(raw).text;
  const parts = text.split(/(\/(?:c|events|u)\/[A-Za-z0-9-]+)/g);
  return <>{parts.map((p, i) => (/^\/(c|events|u)\//.test(p) ? <Link key={i} href={p} className="font-medium text-accent underline underline-offset-4">{p.startsWith("/c/") ? "Open club" : p.startsWith("/events/") ? "Open event" : "Open profile"} →</Link> : <span key={i}>{p}</span>))}</>;
}

// Which lookups Copilot ran for an answer: a live chip while it works, then "Checked: …".
export function Lookups({ tools, live }: { tools?: string[]; live: boolean }) {
  if (!tools?.length) return null;
  const last = tools[tools.length - 1];
  const lookups = tools.filter((t) => !t.startsWith("propose_"));
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs whitespace-normal">
      {live ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-muted">
          <motion.span className="size-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
          {TOOL_LABEL[last]?.doing ?? "Looking things up"}…
        </span>
      ) : (
        // Drafts show as cards, so "Checked" lists only what Copilot looked up.
        lookups.length > 0 && <span className="text-faint">Checked: {[...new Set(lookups.map((t) => TOOL_LABEL[t]?.done ?? t))].join(" · ")}</span>
      )}
    </div>
  );
}


// What a new chat opens with: up to three steps from the member's own record (lib/ember-record.ts).
// They come from the database, not the model. One tap asks Ember, or opens the page that does it.
function NextSteps({ steps, busy, onAsk }: { steps: NextStep[]; busy: boolean; onAsk: (s: Extract<NextStep, { text: string }>) => void }) {
  const row = "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-hover disabled:opacity-50";
  return (
    <section aria-labelledby="ember-next" className="mt-7">
      <h2 id="ember-next" className="px-1 text-xs font-medium text-muted">Next on your record</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {steps.map((s) => {
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-pretty text-text">{s.label}</span>
                <span className="mt-0.5 block text-xs text-pretty text-muted">{s.hint}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
            </>
          );
          return <li key={s.id}>{"href" in s ? <Link href={s.href} className={row}>{body}</Link> : <button type="button" disabled={busy} onClick={() => onAsk(s)} className={row}>{body}</button>}</li>;
        })}
      </ul>
    </section>
  );
}

// The chat: a rail of your saved chats (when supabase/copilot-chats.sql has run), the conversation
// with real Brazework cards under each answer, tap-to-ask follow-ups, and the confirm cards.
const ACTION_ICON: Record<EmberAction["id"], ComposerAction["icon"]> = { log: BadgeCheck, post: FileText, github: GitBranch, sign: ShieldCheck, review: ScrollText, story: Waypoints, event: CalendarCheck, people: Users };

export function CopilotChat({ first, field, student = true, initial = "", initialPreset = null, chats = [], chat = null, saving = false, fromTools = null, steps = [] }: { steps?: NextStep[]; first: string; field: string; student?: boolean; initial?: string; initialPreset?: Preset | null; chats?: ChatSummary[]; chat?: { id: string; title: string; messages: SavedMsg[] } | null; saving?: boolean; fromTools?: FromTools | null }) {
  const { run, stop, busy, error, remaining } = useCopilot();
  const [msgs, setMsgs] = useState<Msg[]>(chat?.messages ?? []);
  const [chatId, setChatId] = useState<string | null>(chat?.id ?? null);
  const [list, setList] = useState<ChatSummary[]>(chats);
  const [opening, setOpening] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const actions: ComposerAction[] = emberActions({ field, student }).map((a) => ({ ...a, icon: ACTION_ICON[a.id] }));

  const send = async (text: string, preset?: Preset) => {
    const q = text.trim();
    if (!q || busy || opening) return;
    const before = msgs;
    const asked: Msg = { role: "user", content: q };
    let last: Msg = { role: "assistant", content: "" };
    setMsgs([...before, asked, last]);
    setInput("");
    const out = await run({ task: "ask", input: q, preset, history: before.slice(-10).map(({ role, content }) => ({ role, content })) }, (full, tools, proposals) => {
      const { text: body, next } = splitNext(full);
      last = { role: "assistant", content: body, tools, proposals, next };
      setMsgs([...before, asked, last]);
    });
    if (out === null && !last.content) { setMsgs(before); return; }
    if (!saving || !last.content) return;
    // Keep the chat (only you can see it). The URL follows, so a refresh brings it back.
    const r = await saveChat(chatId, [...before, asked, last].map(toSaved)).catch(() => null);
    if (!r?.id) return;
    const id = r.id;
    if (id !== chatId) { setChatId(id); window.history.replaceState(null, "", `/copilot?chat=${id}`); }
    setList((l) => [{ id, title: r.title, updated_at: new Date().toISOString() }, ...l.filter((c) => c.id !== id)]);
  };
  // Arrived from search with a question (/copilot?q=…): ask it once.
  const askedInitial = useRef(false);
  useEffect(() => {
    if (!initial || askedInitial.current) return;
    // Marked as asked when it is sent, not when it's scheduled: in development React runs an effect,
    // cleans it up and runs it again, and marking it early left the second run with nothing to send.
    const t = setTimeout(() => { askedInitial.current = true; void send(initial, initialPreset ?? undefined); }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const newChat = () => { stop(); setMsgs([]); setInput(""); setChatId(null); setShowHistory(false); window.history.replaceState(null, "", "/copilot"); };
  const open = async (id: string) => {
    if (id === chatId) { setShowHistory(false); return; }
    stop();
    setOpening(id);
    const c = await loadChat(id).catch(() => null);
    setOpening(null);
    setShowHistory(false);
    if (!c) { setList((l) => l.filter((x) => x.id !== id)); return; }
    setMsgs(c.messages);
    setChatId(c.id);
    window.history.replaceState(null, "", `/copilot?chat=${c.id}`);
  };
  const remove = async (id: string) => {
    setList((l) => l.filter((c) => c.id !== id));
    if (id === chatId) newChat();
    await deleteChat(id);
  };
  const removeAll = async () => {
    if (!confirm("Delete all your Ember chats? This can't be undone.")) return;
    const r = await deleteAllChats();
    if (r.ok) { setList([]); newChat(); }
  };
  const empty = !msgs.length;
  const lastAnswer = msgs.at(-1);

  const composer = (
    <div className={cn(empty ? "mt-7" : "sticky bottom-[var(--m-bottom)] mt-4 md:bottom-4")}>
      <EmberComposer value={input} onChange={setInput} onSend={(t) => void send(t)} onStop={stop} busy={busy} hero={empty} actions={empty ? actions : []} saving={saving} remaining={remaining} />
    </div>
  );

  const rail = saving && (
    <ChatRail list={list} current={chatId} opening={opening} onOpen={(id) => void open(id)} onNew={newChat} onDelete={(id) => void remove(id)} onDeleteAll={() => void removeAll()} />
  );

  return (
    <div className={cn(saving && "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8")}>
      {rail && <aside aria-label="Your Ember chats" className="sticky top-6 hidden h-[calc(100dvh-8rem)] lg:block">{rail}</aside>}
      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-3xl flex-col">
        {saving && (
          <div className="relative mb-2 flex justify-end lg:hidden">
            <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><History className="size-3.5" /> Your chats</button>
            {showHistory && <div className="absolute top-full right-0 z-30 mt-1 h-96 w-72 rounded-3xl border border-line bg-surface p-3 shadow-[var(--shadow)]">{rail}</div>}
          </div>
        )}
        {empty ? (
          <>
            {/* A new chat: the greeting and the box, a little above the middle of the page. */}
            <div className="flex flex-1 flex-col justify-center pb-[8vh]">
              <Hero title={emberGreeting(first)} sub="Say what you did or what you need. Ember looks it up on Brazework and prepares each step as a card you approve." mood={busy ? "thinking" : "idle"} />
              {steps.length > 0 && <NextSteps steps={steps} busy={busy} onAsk={(s) => {
                // A step that starts a sentence waits in the box for the member to finish it.
                if (s.finish) { setInput(s.text); document.getElementById("copilot-input")?.focus(); } else void send(s.text);
              }} />}
              {composer}
              {fromTools && <FromYourTools {...fromTools} />}
            </div>
          </>
        ) : (
          <div className="glass sticky top-[var(--m-top)] z-20 flex items-center gap-3 rounded-2xl px-3 py-2 md:top-3">
            <Ember size={30} mood={busy ? "thinking" : "happy"} />
            <span className="min-w-0 truncate text-sm font-medium">{list.find((c) => c.id === chatId)?.title ?? "Ember"}</span>
            <button type="button" onClick={newChat} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><Plus className="size-3.5" /> New chat</button>
          </div>
        )}
        <div className={cn("flex flex-col gap-5", !empty && "mt-6 flex-1")}>
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => {
              const live = busy && i === msgs.length - 1;
              const question = msgs[i - 1]?.role === "user" ? msgs[i - 1].content : "";
              return (
                <motion.div key={`${chatId ?? "new"}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" ? (
                    <p className="bg-accent-grad max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap text-on-accent">{m.content}</p>
                  ) : (
                    <div className="flex max-w-[94%] min-w-0 gap-3">
                      <Ember size={32} mood={live ? "thinking" : "idle"} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="glass-card rounded-3xl rounded-tl-md px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">
                          <Lookups tools={m.tools} live={live} />
                          {m.content ? <Rich text={m.content} /> : m.tools?.length ? null : <span className="inline-flex gap-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.span key={d} className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
                          {!live && m.content && <LinkCards paths={forgeLinks(m.content)} />}
                          {m.proposals?.map((p) => <ProposalCard key={p.id} p={p} />)}
                          {!m.proposals?.length && m.cards?.length ? <p className="mt-3 text-xs text-faint">Drafted for you: {m.cards.join(", ")}</p> : null}
                        </div>
                        {m.content && !live && (
                          <div className="relative mt-1.5 ml-2 flex items-center gap-0.5">
                            <CopyButton text={m.content} />
                            {saving && <Rate question={question} answer={m.content} tools={m.tools ?? []} />}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {/* Next steps Ember suggests, one tap to ask. */}
          {!busy && lastAnswer?.role === "assistant" && lastAnswer.next?.length ? (
            <div className="flex flex-wrap gap-2 pl-11">
              {lastAnswer.next.map((n) => (
                <button key={n} type="button" onClick={() => void send(n)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-left text-xs font-medium text-text-2 transition hover:border-line-strong hover:text-text active:scale-95">
                  <CornerDownRight className="size-3.5 shrink-0 text-accent" /> {n}
                </button>
              ))}
            </div>
          ) : null}
          <div ref={end} />
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        {!empty && composer}
        {remaining !== null && empty && <p className="mt-1 text-center text-xs text-faint">{remaining} Ember {remaining === 1 ? "request" : "requests"} left today</p>}
      </div>
    </div>
  );
}

function ChatRail({ list, current, opening, onOpen, onNew, onDelete, onDeleteAll }: { list: ChatSummary[]; current: string | null; opening: string | null; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void; onDeleteAll: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <button type="button" onClick={onNew} className="glass-card inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition"><Plus className="size-4" /> New chat</button>
      <h2 className="mt-5 mb-2 px-2 text-xs font-medium tracking-wide text-faint uppercase">Your chats</h2>
      <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
        {list.map((c) => (
          <li key={c.id} className="group relative">
            <button type="button" onClick={() => onOpen(c.id)} aria-current={c.id === current ? "true" : undefined} className={cn("block w-full rounded-xl py-2 pr-8 pl-3 text-left transition", c.id === current ? "bg-hover text-text" : "text-text-2 hover:bg-hover hover:text-text")}>
              <span className="flex items-center gap-1.5 truncate text-sm">{opening === c.id && <Loader2 className="size-3.5 shrink-0 animate-spin" />}<span className="truncate">{c.title || "New chat"}</span></span>
              <span className="block text-[11px] text-faint">{ago(c.updated_at)}</span>
            </button>
            <button type="button" onClick={() => onDelete(c.id)} aria-label={`Delete chat: ${c.title}`} className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-faint opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-text focus-visible:opacity-100"><Trash2 className="size-3.5" /></button>
          </li>
        ))}
        {!list.length && <li className="px-3 py-2 text-xs leading-relaxed text-muted">Your chats with Ember show up here. Only you can see them.</li>}
      </ul>
      <div className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
        Private to you. Kept 180 days after you last use them.
        {list.length > 0 && <button type="button" onClick={onDeleteAll} className="mt-1 block underline underline-offset-2 hover:text-text">Delete all chats</button>}
      </div>
    </div>
  );
}

const REASONS = ["Wrong or made up", "Not helpful", "Unsafe or inappropriate", "Didn't do what I asked"];

// Thumbs up or down on one answer. A rating sends only this question and answer to the Brazework team.
function Rate({ question, answer, tools }: { question: string; answer: string; tools: string[] }) {
  const [state, setState] = useState<"idle" | "down" | "sent">("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const send = async (rating: "up" | "down") => {
    setPending(true);
    const r = await rateAnswer(rating, question, answer, tools, [reason, note.trim()].filter(Boolean).join(": ")).catch(() => ({ ok: false }));
    setPending(false);
    if (r.ok) setState("sent");
  };
  if (state === "sent") return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-faint"><Check className="size-3.5" /> Thanks, that helps Ember improve</span>;
  return (
    <>
      <button type="button" disabled={pending} onClick={() => void send("up")} aria-label="Good answer" className="grid size-7 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text"><ThumbsUp className="size-3.5" /></button>
      <button type="button" disabled={pending} onClick={() => setState((s) => (s === "down" ? "idle" : "down"))} aria-label="Bad answer" aria-expanded={state === "down"} className={cn("grid size-7 place-items-center rounded-full transition hover:bg-hover hover:text-text", state === "down" ? "text-text" : "text-faint")}><ThumbsDown className="size-3.5" /></button>
      {state === "down" && (
        <div role="dialog" aria-label="What went wrong?" className="absolute top-full left-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between"><span className="text-sm font-medium">What went wrong?</span><button type="button" onClick={() => setState("idle")} aria-label="Close" className="grid size-7 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3.5" /></button></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r === reason ? "" : r)} aria-pressed={r === reason} className={cn("rounded-full border px-2.5 py-1 text-xs transition", r === reason ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-muted hover:border-line-strong hover:text-text")}>{r}</button>)}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={2} placeholder="Anything else? (optional)" className="mt-2 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-line-strong" />
          <p className="mt-1 text-[11px] leading-snug text-faint">Sends this question and answer to the Brazework team, nothing else from the chat.</p>
          <button type="button" disabled={pending || (!reason && !note.trim())} onClick={() => void send("down")} className="bg-accent-grad mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-on-accent disabled:opacity-40">{pending && <Loader2 className="size-3.5 animate-spin" />} Send</button>
        </div>
      )}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-faint transition hover:bg-hover hover:text-text">
      {done ? <><Check className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
    </button>
  );
}

// Drafts your AI tools left over MCP (supabase/tool-actions.sql), as the same cards Ember prepares:
// Claude drafts it, you confirm it here or on /drafts. Posts and milestones keep their own page.
export type FromTools = { cards: { draftId: string; via: string; source: string; p: Proposal }[]; others: number };
function FromYourTools({ cards, others }: FromTools) {
  if (!cards.length && !others) return null;
  return (
    <section aria-label="Waiting from your tools" className="mt-6">
      <h2 className="mb-1 flex items-center px-1 text-xs font-medium tracking-wide text-faint uppercase">
        Waiting from your tools
        <Link href="/drafts" className="ml-auto text-[11px] font-medium tracking-normal normal-case text-muted hover:text-text">{others ? `${others} more in Drafts` : "All drafts"}</Link>
      </h2>
      {cards.map((c) => <ProposalCard key={c.draftId} p={c.p} fromTool={{ draftId: c.draftId, via: c.via, source: c.source }} />)}
    </section>
  );
}
