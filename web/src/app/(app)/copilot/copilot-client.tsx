"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, BadgeCheck, CalendarCheck, CalendarDays, Check, Compass, Copy, CornerDownRight, FileText, GitBranch, History, Loader2, Megaphone, MessageSquare, Plus, Search, ShieldCheck, Square, ThumbsDown, ThumbsUp, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCopilot } from "@/components/copilot/use-copilot";
import { cn } from "@/lib/forge";
import { TOOL_LABEL, type Proposal } from "@/lib/copilot-agent";
import { Ember } from "@/components/ember/ember";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { LinkCards } from "@/components/copilot/link-cards";
import { forgeLinks, splitNext } from "@/lib/copilot-text";
import { deleteAllChats, deleteChat, loadChat, rateAnswer, saveChat, type ChatSummary, type SavedMsg } from "@/lib/copilot-chats";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[]; cards?: string[]; next?: string[] };

// What a card Ember prepared is called once the chat is saved (saved chats keep a label, never a
// live card that could be confirmed twice).
const CARD_LABEL: Record<Proposal["kind"], string> = { post: "a post", milestone: "a milestone to verify", join: "joining a club", follow: "a follow", event: "a club event", club_post: "a club post", project: "a project", review: "a milestone review", rsvp: "an RSVP", message: "a message" };
const toSaved = (m: Msg): SavedMsg => ({ role: m.role, content: m.content, tools: m.tools, cards: [...(m.cards ?? []), ...(m.proposals ?? []).map((p) => CARD_LABEL[p.kind])] });
const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return d < 1 ? "Today" : d < 2 ? "Yesterday" : d < 7 ? `${Math.floor(d)} days ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// The orb, front and centre, with a greeting: the empty state of the chat and the waiting state.
function Hero({ title, sub, mood = "idle" }: { title: string; sub: string; mood?: "idle" | "thinking" | "happy" | "sleepy" }) {
  return (
    <header className="flex flex-col items-center pt-6 text-center sm:pt-10">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <Ember size={112} mood={mood} label="Ember, your Brazework Copilot" />
      </motion.div>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted">{sub}</p>
    </header>
  );
}

const CAPS = [
  { icon: Compass, title: "Find and join", body: "Finds the clubs, events and people that fit you, then joins, RSVPs, follows or messages for you once you tap OK." },
  { icon: GitBranch, title: "Build your record", body: "Imports your GitHub projects, writes them up from the README, and asks your club to verify milestones." },
  { icon: Megaphone, title: "Run your club", body: "Weekly reports, the verification queue, events and club updates, posted to Brazework and Discord." },
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
            return <Link key={label as string} href={href as string} className="glass-card inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-text-2 transition hover:-translate-y-px hover:text-text"><I className="size-4" /> {label as string} <ArrowRight className="size-3.5 text-faint" /></Link>;
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


// The chat: a rail of your saved chats (when supabase/copilot-chats.sql has run), the conversation
// with real Brazework cards under each answer, tap-to-ask follow-ups, and the confirm cards.
export function CopilotChat({ first, field, initial = "", chats = [], chat = null, saving = false }: { first: string; field: string; initial?: string; chats?: ChatSummary[]; chat?: { id: string; title: string; messages: SavedMsg[] } | null; saving?: boolean }) {
  const { run, stop, busy, error, remaining } = useCopilot();
  const [msgs, setMsgs] = useState<Msg[]>(chat?.messages ?? []);
  const [chatId, setChatId] = useState<string | null>(chat?.id ?? null);
  const [list, setList] = useState<ChatSummary[]>(chats);
  const [opening, setOpening] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const GROUPS = [
    { label: "Get it done", ideas: [
      { icon: GitBranch, text: "Add my GitHub repo to my profile: github.com/" },
      { icon: CalendarCheck, text: "Find an event this week that fits me and RSVP me." },
    ] },
    { label: "Meet people", ideas: [
      { icon: Users, text: "Which clubs on Brazework fit me best? Help me join one." },
      { icon: MessageSquare, text: `Find someone in ${field || "my field"} worth meeting and draft an intro message.` },
    ] },
    { label: "Build your record", ideas: [
      { icon: BadgeCheck, text: "Help me get my latest milestone verified by my club." },
      { icon: FileText, text: "Turn these notes into a project post: " },
    ] },
  ];

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy || opening) return;
    const before = msgs;
    const asked: Msg = { role: "user", content: q };
    let last: Msg = { role: "assistant", content: "" };
    setMsgs([...before, asked, last]);
    setInput("");
    const out = await run({ task: "ask", input: q, history: before.slice(-10).map(({ role, content }) => ({ role, content })) }, (full, tools, proposals) => {
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
    askedInitial.current = true;
    const t = setTimeout(() => void send(initial), 0);
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
    <div className={cn(empty ? "mt-8" : "sticky bottom-[var(--m-bottom)] mt-4 md:bottom-4")}>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className={cn("flex items-end gap-2 rounded-3xl p-2", empty ? "glass-card" : "glass")}>
        <label htmlFor="copilot-input" className="sr-only">Ask Ember</label>
        <textarea
          id="copilot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          rows={1}
          maxLength={4000}
          autoFocus={empty}
          placeholder={empty ? "Ask Ember anything about your work or field" : "Reply to Ember"}
          style={{ outline: "none" }}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] placeholder:text-faint"
        />
        {busy ? (
          <button type="button" onClick={stop} aria-label="Stop" className="grid size-11 place-items-center rounded-full border border-line text-text transition hover:bg-hover"><Square className="size-4 fill-current" /></button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Send" className="bg-accent-grad grid size-11 place-items-center rounded-full text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:-translate-y-px active:scale-90 disabled:opacity-40"><ArrowUp className="size-5" /></button>
        )}
      </form>
      {/* Plain disclosure, every time: what Ember is and what it can do on its own (nothing). */}
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-faint">
        <ShieldCheck className="size-3.5 shrink-0" />
        <span>Ember is AI and can be wrong. It only acts when you confirm a card.{saving ? " Chats are private to you and kept 180 days." : ""} <Link href="/settings#ember" className="underline underline-offset-2 hover:text-text">Privacy</Link></span>
      </p>
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
            <Hero title={`Hi ${first}, what are we building?`} sub="Ask for anything on Brazework. Ember looks it up, shows you the real clubs, events and people, then prepares the next step as a card you approve." mood={busy ? "thinking" : "idle"} />
            {composer}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {GROUPS.map((g, gi) => (
                <div key={g.label}>
                  <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-faint uppercase">{g.label}</h2>
                  <div className="flex flex-col gap-2">
                    {g.ideas.map((idea, i) => (
                      <motion.button
                        key={idea.text}
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + (gi * 2 + i) * 0.04 }}
                        onClick={() => (idea.text.endsWith(": ") || idea.text.endsWith("/") ? (setInput(idea.text), document.getElementById("copilot-input")?.focus()) : void send(idea.text))}
                        className="glass-card group flex items-start gap-3 rounded-2xl p-3 text-left text-sm transition duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        <span className="nav-tile grid size-8 shrink-0 place-items-center rounded-[10px] text-text-2 transition group-hover:text-text"><idea.icon className="size-4" /></span>
                        <span className="pt-1 leading-snug text-text-2">{idea.text}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="glass sticky top-[var(--m-top)] z-20 flex items-center gap-3 rounded-2xl px-3 py-2 md:top-3">
            <Ember size={30} mood={busy ? "thinking" : "happy"} />
            <span className="min-w-0 truncate text-sm font-medium">{list.find((c) => c.id === chatId)?.title ?? "Ember"}</span>
            <button type="button" onClick={newChat} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><Plus className="size-3.5" /> New chat</button>
          </div>
        )}
        <div className={cn("flex flex-1 flex-col gap-5", !empty && "mt-6")}>
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
                <button key={n} type="button" onClick={() => void send(n)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-left text-xs font-medium text-text-2 transition hover:-translate-y-px hover:border-line-strong hover:text-text active:scale-95">
                  <CornerDownRight className="size-3.5 shrink-0 text-accent" /> {n}
                </button>
              ))}
            </div>
          ) : null}
          <div ref={end} />
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        {!empty && composer}
        {remaining !== null && <p className="mt-1 text-center text-xs text-faint">{remaining} Copilot {remaining === 1 ? "request" : "requests"} left today</p>}
      </div>
    </div>
  );
}

function ChatRail({ list, current, opening, onOpen, onNew, onDelete, onDeleteAll }: { list: ChatSummary[]; current: string | null; opening: string | null; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void; onDeleteAll: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <button type="button" onClick={onNew} className="glass-card inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition hover:-translate-y-px"><Plus className="size-4" /> New chat</button>
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
          <button type="button" disabled={pending || (!reason && !note.trim())} onClick={() => void send("down")} className="bg-accent-grad mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-on-accent disabled:opacity-40">{pending && <Loader2 className="size-3.5 animate-spin" />} Send</button>
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
