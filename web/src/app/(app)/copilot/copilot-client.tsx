"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { AnimatePresence, motion } from "motion/react";
import type { Preset } from "@/lib/copilot-presets";
import { ArrowRight, BadgeCheck, CalendarCheck, CalendarDays, Check, Compass, Copy, CornerDownRight, FileText, GitBranch, History, Loader2, Megaphone, PanelLeftClose, PanelLeftOpen, Plus, ScrollText, Search, ShieldCheck, ThumbsDown, ThumbsUp, Trash2, Users, Waypoints, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCopilot } from "@/components/copilot/use-copilot";
import { cn } from "@/lib/forge";
import { TOOL_LABEL, type Proposal, type Segment } from "@/lib/copilot-agent";
import { EmberReply, Thinking } from "@/components/copilot/reply";
import { useStickToBottom } from "@/components/copilot/stick-to-bottom";
import { Ember } from "@/components/ember/ember";
import { EmberComposer, type ComposerAction } from "@/components/copilot/composer";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { LinkCards } from "@/components/copilot/link-cards";
import { forgeLinks, splitNext } from "@/lib/copilot-text";
import { emberActions, emberGreeting, type EmberAction } from "@/lib/ember-actions";
import type { NextStep } from "@/lib/ember-record";
import { CARD_LABEL, MAX_TURN, cardsOf, savedCards, type CardOutcome, type OfferedChoice, type ThreadTurn } from "@/lib/ember-thread";
import { carryOnSteps, followsAfter, pickedFrom } from "@/lib/ember-bar";
import { ChoiceButtons } from "@/components/copilot/choices";
import { deleteAllChats, deleteChat, loadChat, rateAnswer, saveChat, type ChatSummary, type SavedMsg } from "@/lib/copilot-chats";

// `outcomes`: a saved chat's cards and what happened to them (a live answer has `proposals` instead).
type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[]; segments?: Segment[]; cards?: string[]; next?: string[]; outcomes?: CardOutcome[]; choice?: OfferedChoice; follow?: boolean };
// What happened to each card on screen, by the card's id (lib/ember-thread.ts).
type Done = Record<string, CardOutcome>;
const cardsFor = (m: Msg, done: Done): CardOutcome[] => (m.proposals?.length ? cardsOf(m.proposals, done) : m.outcomes ?? []);
// The chat so far as Torch gets it: the words of each turn, and what became of each answer's cards.
const toHistory = (msgs: Msg[], done: Done): ThreadTurn[] => msgs.slice(-10).map((m) => {
  const cards = m.role === "assistant" ? cardsFor(m, done) : [];
  return { role: m.role, content: m.content.slice(0, MAX_TURN), ...(cards.length ? { cards } : {}), ...(m.choice ? { choice: m.choice } : {}), ...(m.follow ? { follow: true } : {}) };
});
// Answers Torch offered that are still waiting: on the newest message, and none tapped yet.
const openChoice = (m: Msg | undefined) => (m?.role === "assistant" && m.choice && !m.choice.picked ? m.choice : null);

// What a card Torch prepared is called once the chat is saved (saved chats keep a label, never a
// live card that could be confirmed twice).
// (CARD_LABEL lives in lib/ember-thread.ts, shared with the note Torch reads.)
const toSaved = (done: Done) => (m: Msg): SavedMsg => ({ role: m.role, content: m.content, tools: m.tools, cards: [...(m.cards ?? []), ...(m.proposals ?? []).map((p) => CARD_LABEL[p.kind])], outcomes: cardsFor(m, done), ...(m.choice ? { choice: m.choice } : {}), ...(m.follow ? { follow: true } : {}) });
const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return d < 1 ? "Today" : d < 2 ? "Yesterday" : d < 7 ? `${Math.floor(d)} days ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// The orb, front and centre, with a greeting: the empty state of the chat and the waiting state.
function Hero({ title, sub, mood = "idle" }: { title: string; sub: string; mood?: "idle" | "thinking" | "happy" | "sleepy" }) {
  return (
    <header className="flex flex-col items-center pt-2 text-center sm:pt-8">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <Ember size={72} mood={mood} label="Torch, your Brazework assistant" />
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
      <Hero title="Torch is almost here" sub="Your AI teammate on Brazework. It looks things up, then gets things done with your OK:" mood="sleepy" />
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
        <h2 className="text-center text-[13px] font-medium text-faint">Meanwhile</h2>
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

// Rich moved next to EmberReply (components/copilot/reply.tsx); kept here for its importers.
export { Rich } from "@/components/copilot/reply";

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
// They come from the database, not the model. One tap asks Torch, or opens the page that does it.
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
                <span className="block text-sm font-medium text-pretty text-text">{s.label}{"text" in s && !s.finish && <span className="text-xs font-normal text-muted"> · {emberCreditCost("ask")}</span>}</span>
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
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [input, setInput] = useState("");
  // What happened to each card (confirmed, dismissed, refused), so Torch knows on its next turn and a
  // saved chat remembers. Kept apart from `msgs`: a card can be confirmed while a new answer streams.
  const [done, setDone] = useState<Done>({});
  const doneNow = useRef(done);
  useEffect(() => { doneNow.current = done; }, [done]);
  // Torch carries on after a yes (the spec's part 3): a card confirmed with a next step sets a follow turn
  // going, which an effect below sends with this render's state. Free, up to 3 after each ask.
  // Each confirmed card with a next step, numbered so the effect carries on once per card.
  const [pendingFollow, setPendingFollow] = useState<{ id: string; n: number } | null>(null);
  const followed = useRef(0);
  // Free follow-ups left, as this page guesses it for its labels (the database decides).
  const [follows, setFollows] = useState(0);
  // No free follow-up was left: the card's next step, offered for a credit instead.
  const [carryPaid, setCarryPaid] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const onOutcome = (id: string, o: CardOutcome, settled: boolean) => {
    doneNow.current = { ...doneNow.current, [id]: o };
    setDone((d) => ({ ...d, [id]: o }));
    if (settled && o.state === "confirmed" && o.then) setPendingFollow((p) => ({ id, n: (p?.n ?? 0) + 1 }));
  };
  // Follows the answer down as it grows, only while you're at the bottom: scroll up to read and it
  // stays put (redesign 2026-11; it used to start a smooth scroll on every streamed chunk).
  const thread = useRef<HTMLDivElement>(null);
  const follow = useStickToBottom(thread, msgs.length > 0);

  const actions: ComposerAction[] = emberActions({ field, student }).map((a) => ({ ...a, icon: ACTION_ICON[a.id] }));

  // `tapped`: one of the answers Torch offered, so the message that offered them records which.
  // `carry`: a free follow turn: after a confirmed card (no words) or a tapped answer.
  const send = async (text: string, preset?: Preset, tapped?: string, carry = false) => {
    const q = text.trim();
    if ((!q && !carry) || busy || opening) return;
    const was = msgs;
    const before = msgs.map((m, i) => (i === msgs.length - 1 && m.choice ? { ...m, choice: pickedFrom(m.choice, tapped) } : m));
    const asked: Msg = { role: "user", content: q, ...(carry ? { follow: true } : {}) };
    let last: Msg = { role: "assistant", content: "" };
    setMsgs([...before, asked, last]);
    setInput("");
    setCarryPaid([]);
    setNotice("");
    follow();
    let refused = false;
    const out = await run({ task: "ask", input: q, preset, history: toHistory(before, doneNow.current), choices: true, ...(carry ? { follow: true } : {}) }, (full, tools, proposals, segments, choice) => {
      const { text: body, next } = splitNext(full);
      last = { role: "assistant", content: body, tools, proposals, segments, next, ...(choice ? { choice: { options: choice.options } } : {}) };
      setMsgs([...before, asked, last]);
    }, { onRefused: () => { refused = true; } });
    if (refused) {
      // No free follow-up left: back as it was, and the next step is offered for a credit.
      setMsgs(was);
      setFollows(0);
      const lastAnswer = was.at(-1);
      if (!q && lastAnswer) setCarryPaid(carryOnSteps(cardsFor(lastAnswer, doneNow.current)));
      else setNotice("Torch's free follow-ups for that question are used up, so answering now takes a credit.");
      return;
    }
    if (out === null && !last.content) { setMsgs(before); return; }
    setFollows((f) => followsAfter(f, carry, false));
    if (!saving || !last.content) return;
    // Keep the chat (only you can see it). The URL follows, so a refresh brings it back.
    const r = await saveChat(chatId, [...before, asked, last].map(toSaved(doneNow.current))).catch(() => null);
    if (!r?.id) return;
    const id = r.id;
    if (id !== chatId) { setChatId(id); window.history.replaceState(null, "", `/copilot?chat=${id}`); }
    setList((l) => [{ id, title: r.title, updated_at: new Date().toISOString() }, ...l.filter((c) => c.id !== id)]);
  };
  // A card was confirmed with a next step: carry on, if it's in the newest answer and nothing is running.
  // Otherwise its outcome simply rides along with the member's next question.
  useEffect(() => {
    if (!pendingFollow || pendingFollow.n === followed.current) return;
    const { id, n } = pendingFollow;
    const last = msgs.at(-1);
    if (busy || opening || last?.role !== "assistant" || !last.proposals?.some((p) => p.id === id)) return;
    // Marked when it's sent, not when it's scheduled (as with ?q= below): in development React runs an
    // effect, cleans it up and runs it again.
    const t = setTimeout(() => { followed.current = n; void send("", undefined, undefined, true); }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFollow]);
  // A card answered after the chat was saved: save again, so opening the chat later still knows.
  // (While an answer is streaming, the save at its end carries it.)
  useEffect(() => {
    if (!saving || !chatId || busy || !Object.keys(done).length) return;
    void saveChat(chatId, msgs.map(toSaved(done))).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
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
    if (!confirm("Delete all your Torch chats? This can't be undone.")) return;
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
    <div className={cn(
      saving && "xl:grid xl:grid-cols-[var(--ember-rail)_minmax(0,1fr)_var(--ember-rail)] xl:gap-5 2xl:gap-8",
      historyCollapsed ? "[--ember-rail:2.75rem]" : "[--ember-rail:clamp(14rem,19vw,20rem)]",
    )}>
      {rail && (
        <aside aria-label="Torch chat history" className="sticky top-6 hidden h-[calc(100dvh-3rem)] min-w-0 flex-col gap-3 self-start xl:flex">
          <button
            type="button"
            aria-expanded={!historyCollapsed}
            aria-controls="ember-desktop-history"
            aria-label={historyCollapsed ? "Expand chat history" : "Collapse chat history"}
            title={historyCollapsed ? "Expand chat history" : "Collapse chat history"}
            onClick={() => setHistoryCollapsed((collapsed) => !collapsed)}
            className="glass-card grid size-11 shrink-0 place-items-center self-start rounded-xl text-muted transition hover:text-text"
          >
            {historyCollapsed ? <PanelLeftOpen className="size-5" aria-hidden="true" /> : <PanelLeftClose className="size-5" aria-hidden="true" />}
          </button>
          <div id="ember-desktop-history" className="min-h-0 flex-1" hidden={historyCollapsed}>{rail}</div>
        </aside>
      )}
      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full min-w-0 max-w-3xl flex-col">
        {saving && (
          <div className="relative mb-2 flex justify-end xl:hidden">
            <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} aria-controls={showHistory ? "ember-mobile-history" : undefined} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-hover hover:text-text"><History className="size-3.5" /> Your chats</button>
            {showHistory && <div id="ember-mobile-history" className="absolute top-full right-0 z-30 mt-1 h-[min(70dvh,38rem)] w-[min(22rem,85vw)] rounded-3xl border border-line bg-surface p-3 shadow-[var(--shadow)]">{rail}</div>}
          </div>
        )}
        {empty ? (
          <>
            {/* A new chat: the greeting and the box, a little above the middle of the page. */}
            <div className="flex flex-1 flex-col justify-center pb-[8vh]">
              <Hero title={emberGreeting(first)} sub="Say what you did or what you need. Torch looks it up on Brazework and prepares each step as a card you approve." mood={busy ? "thinking" : "idle"} />
              {composer}
              {steps.length > 0 && <NextSteps steps={steps} busy={busy} onAsk={(s) => {
                // A step that starts a sentence waits in the box for the member to finish it.
                if (s.finish) { setInput(s.text); document.getElementById("copilot-input")?.focus(); } else void send(s.text);
              }} />}
              {fromTools && <FromYourTools {...fromTools} />}
            </div>
          </>
        ) : (
          <div className="glass sticky top-[var(--m-top)] z-20 flex items-center gap-3 rounded-2xl px-3 py-2 md:top-3">
            <Ember size={30} mood={busy ? "thinking" : "happy"} />
            <span className="min-w-0 truncate text-sm font-medium">{list.find((c) => c.id === chatId)?.title ?? "Torch"}</span>
            <button type="button" onClick={newChat} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><Plus className="size-3.5" /> New chat</button>
          </div>
        )}
        <div ref={thread} className={cn("flex flex-col gap-5", !empty && "mt-6 flex-1")}>
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => {
              const live = busy && i === msgs.length - 1;
              const question = msgs[i - 1]?.role === "user" ? msgs[i - 1].content : "";
              return (
                <motion.div key={`${chatId ?? "new"}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" && m.follow && !m.content ? (
                    <p className="w-full pl-11 text-xs text-muted">Confirmed. Carrying on…</p>
                  ) : m.role === "user" ? (
                    <p className="bg-accent-grad max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap text-on-accent">{m.content}</p>
                  ) : (
                    <div className="flex w-full min-w-0 gap-3">
                      <Ember size={32} mood={live ? "thinking" : "idle"} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        {/* Full width from the first word, so the reply never reflows sideways as it grows. */}
                        <div className="glass-card rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">
                          <Lookups tools={m.tools} live={live} />
                          {m.content || m.proposals?.length
                            ? <EmberReply text={m.content} proposals={m.proposals} segments={m.segments} live={live} cardProps={{ onOutcome }} />
                            : live && !m.tools?.length ? <Thinking /> : null}
                          {!live && m.content && <LinkCards paths={forgeLinks(m.content)} />}
                          {!m.proposals?.length && m.cards?.length ? <p className="mt-3 text-xs text-faint">Drafted for you: {m.outcomes?.length ? savedCards(m.outcomes) : m.cards.join(", ")}</p> : null}
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
          {/* Torch is waiting on an answer: the ones it offered, as buttons. */}
          {!busy && openChoice(lastAnswer) ? (
            <div className="pl-11"><ChoiceButtons options={openChoice(lastAnswer)!.options} onPick={(o) => void send(o, undefined, o, follows > 0)} typeHint="type your own answer below" cost={follows > 0 ? emberCreditCost("follow") : emberCreditCost("ask")} /></div>
          ) : null}
          {/* No free follow-up was left after a confirmed card: carry on for a credit. */}
          {!busy && carryPaid.length > 0 ? (
            <div className="pl-11">
              <button type="button" onClick={() => void send(`Carry on: ${carryPaid.join("; then ")}`)} className="min-h-10 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-left text-sm font-medium text-text transition hover:bg-hover active:scale-[0.98]">
                Carry on: {carryPaid.join("; then ")} <span className="text-xs font-normal text-muted">· {emberCreditCost("ask")}</span>
              </button>
            </div>
          ) : null}
          {notice && <p className="pl-11 text-xs text-muted">{notice}</p>}
          {/* Next steps Torch suggests, one tap to ask; not while it's waiting on an answer. */}
          {!busy && !openChoice(lastAnswer) && lastAnswer?.role === "assistant" && lastAnswer.next?.length ? (
            <div className="flex flex-wrap gap-2 pl-11">
              {lastAnswer.next.map((n) => (
                <button key={n} type="button" onClick={() => void send(n)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-left text-xs font-medium text-text-2 transition hover:border-line-strong hover:text-text active:scale-95">
                  <CornerDownRight className="size-3.5 shrink-0 text-accent" /> {n} <span className="text-xs text-muted">· {emberCreditCost("ask")}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        {!empty && composer}
      </div>
    </div>
  );
}

function ChatRail({ list, current, opening, onOpen, onNew, onDelete, onDeleteAll }: { list: ChatSummary[]; current: string | null; opening: string | null; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void; onDeleteAll: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <button type="button" onClick={onNew} className="glass-card inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition"><Plus className="size-4" /> New chat</button>
      <h2 className="mt-5 mb-2 px-2 text-[13px] font-medium text-faint">Your chats</h2>
      <ul className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        {list.map((c) => (
          <li key={c.id} className="group relative">
            <button type="button" onClick={() => onOpen(c.id)} aria-current={c.id === current ? "true" : undefined} className={cn("block w-full rounded-xl py-2 pr-8 pl-3 text-left transition", c.id === current ? "bg-hover text-text" : "text-text-2 hover:bg-hover hover:text-text")}>
              <span className="flex items-center gap-1.5 truncate text-sm">{opening === c.id && <Loader2 className="size-3.5 shrink-0 animate-spin" />}<span className="truncate">{c.title || "New chat"}</span></span>
              <span className="block text-[11px] text-faint">{ago(c.updated_at)}</span>
            </button>
            <button type="button" onClick={() => onDelete(c.id)} aria-label={`Delete chat: ${c.title}`} className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-faint opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-text focus-visible:opacity-100"><Trash2 className="size-3.5" /></button>
          </li>
        ))}
        {!list.length && <li className="px-3 py-2 text-xs leading-relaxed text-muted">Your chats with Torch show up here. Only you can see them.</li>}
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
  if (state === "sent") return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-faint"><Check className="size-3.5" /> Thanks, that helps Torch improve</span>;
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

// Drafts your AI tools left over MCP (supabase/tool-actions.sql), as the same cards Torch prepares:
// Claude drafts it, you confirm it here or on /drafts. Posts and milestones keep their own page.
export type FromTools = { cards: { draftId: string; via: string; source: string; p: Proposal }[]; others: number };
function FromYourTools({ cards, others }: FromTools) {
  if (!cards.length && !others) return null;
  return (
    <section aria-label="Waiting from your tools" className="mt-6">
      <h2 className="mb-1 flex items-center px-1 text-[13px] font-medium text-faint">
        Waiting from your tools
        <Link href="/drafts" className="ml-auto text-[11px] font-medium tracking-normal normal-case text-muted hover:text-text">{others ? `${others} more in Drafts` : "All drafts"}</Link>
      </h2>
      {cards.map((c) => <ProposalCard key={c.draftId} p={c.p} fromTool={{ draftId: c.draftId, via: c.via, source: c.source }} />)}
    </section>
  );
}
