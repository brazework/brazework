"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, BadgeCheck, CalendarCheck, CalendarDays, Check, Compass, Copy, FileText, GitBranch, Megaphone, MessageSquare, Plus, Search, Square, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCopilot } from "@/components/copilot/use-copilot";
import { cn } from "@/lib/forge";
import { TOOL_LABEL, type Proposal } from "@/lib/copilot-agent";
import { Ember } from "@/components/ember/ember";
import { ProposalCard } from "@/components/copilot/proposal-card";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[] };

// The orb, front and centre, with a greeting: the empty state of the chat and the waiting state.
function Hero({ title, sub, mood = "idle" }: { title: string; sub: string; mood?: "idle" | "thinking" | "happy" | "sleepy" }) {
  return (
    <header className="flex flex-col items-center pt-6 text-center sm:pt-10">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <Ember size={112} mood={mood} label="Ember, your Forge Copilot" />
      </motion.div>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted">{sub}</p>
    </header>
  );
}

const CAPS = [
  { icon: Compass, title: "Find and join", body: "Finds the clubs, events and people that fit you, then joins, RSVPs, follows or messages for you once you tap OK." },
  { icon: GitBranch, title: "Build your record", body: "Imports your GitHub projects, writes them up from the README, and asks your club to verify milestones." },
  { icon: Megaphone, title: "Run your club", body: "Weekly reports, the verification queue, events and club updates, posted to Forge and Discord." },
];

// Shown until Copilot is switched on (an API key plus supabase/copilot.sql). Shortcuts still work.
export function CopilotSoon() {
  return (
    <>
      <Hero title="Ember is almost here" sub="Your AI teammate on Forge. It looks things up, then gets things done with your OK:" mood="sleepy" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
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
          {[[Search, "Search Forge", "/search"], [Users, "Find clubs", "/communities?tab=discover"], [CalendarDays, "Events this week", "/events"], [FileText, "Add a project", "/profile#projects"]].map(([Icon, label, href]) => {
            const I = Icon as typeof Search;
            return <Link key={label as string} href={href as string} className="glass-card inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-text-2 transition hover:-translate-y-px hover:text-text"><I className="size-4" /> {label as string} <ArrowRight className="size-3.5 text-faint" /></Link>;
          })}
        </div>
      </section>
    </>
  );
}

// Links Copilot gives (/c/…, /events/…, /u/…) become real links; everything else stays text.
export function Rich({ text }: { text: string }) {
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

export function CopilotChat({ first, field, initial = "" }: { first: string; field: string; initial?: string }) {
  const { run, stop, busy, error, remaining } = useCopilot();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const GROUPS = [
    { label: "Get it done", ideas: [
      { icon: GitBranch, text: "Add my GitHub repo to my profile: github.com/" },
      { icon: CalendarCheck, text: "Find an event this week that fits me and RSVP me." },
    ] },
    { label: "Meet people", ideas: [
      { icon: Users, text: "Which clubs on Forge fit me best? Help me join one." },
      { icon: MessageSquare, text: `Find someone in ${field || "my field"} worth meeting and draft an intro message.` },
    ] },
    { label: "Build your record", ideas: [
      { icon: BadgeCheck, text: "Help me get my latest milestone verified by my club." },
      { icon: FileText, text: "Turn these notes into a project post: " },
    ] },
  ];

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setInput("");
    const out = await run({ task: "ask", input: q, history: history.map(({ role, content }) => ({ role, content })) }, (full, tools, proposals) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full, tools, proposals }]));
    if (out === null) setMsgs((m) => (m.at(-1)?.content === "" ? m.slice(0, -2) : m));
  };
  // Arrived from search with a question (/copilot?q=…): ask it once.
  const asked = useRef(false);
  useEffect(() => {
    if (!initial || asked.current) return;
    asked.current = true;
    const t = setTimeout(() => void send(initial), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const newChat = () => { stop(); setMsgs([]); setInput(""); };
  const empty = !msgs.length;

  const composer = (
    <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className={cn("flex items-end gap-2 rounded-3xl p-2", empty ? "glass-card mt-8" : "glass sticky bottom-24 mt-4 md:bottom-4")}>
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
  );

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      {empty ? (
        <>
          <Hero title={`Hi ${first}, what are we building?`} sub="Ask for anything on Forge. Ember looks it up, then prepares the next step as a card you approve." mood={busy ? "thinking" : "idle"} />
          {composer}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
        <div className="glass sticky top-16 z-20 flex items-center gap-3 rounded-2xl px-3 py-2 md:top-3">
          <Ember size={30} mood={busy ? "thinking" : "happy"} />
          <span className="text-sm font-medium">Ember</span>
          <button type="button" onClick={newChat} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><Plus className="size-3.5" /> New chat</button>
        </div>
      )}
      <div className={cn("flex flex-1 flex-col gap-5", !empty && "mt-6")}>
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "user" ? (
                <p className="bg-accent-grad max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap text-on-accent">{m.content}</p>
              ) : (
                <div className="flex max-w-[94%] gap-3">
                  <Ember size={32} mood={busy && i === msgs.length - 1 ? "thinking" : "idle"} className="mt-0.5" />
                  <div className="min-w-0">
                    <div className="glass-card rounded-3xl rounded-tl-md px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">
                      <Lookups tools={m.tools} live={busy && i === msgs.length - 1} />
                      {m.content ? <Rich text={m.content} /> : m.tools?.length ? null : <span className="inline-flex gap-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.span key={d} className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
                      {m.proposals?.map((p) => <ProposalCard key={p.id} p={p} />)}
                    </div>
                    {m.content && !(busy && i === msgs.length - 1) && <CopyButton text={m.content} />}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {!empty && composer}
      {remaining !== null && <p className="mt-2 text-center text-xs text-faint">{remaining} Copilot {remaining === 1 ? "request" : "requests"} left today</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }} className="mt-1.5 ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-faint transition hover:bg-hover hover:text-text">
      {done ? <><Check className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
    </button>
  );
}
