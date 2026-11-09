"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, BadgeCheck, Compass, FileText, Lightbulb, Mic, PenLine, Square, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCopilot } from "@/components/copilot/use-copilot";
import { cn } from "@/lib/forge";
import { TOOL_LABEL, type Proposal } from "@/lib/copilot-agent";
import { Ember } from "@/components/ember/ember";
import { ProposalCard } from "@/components/copilot/proposal-card";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[] };

function Header({ sub, mood = "idle" }: { sub: string; mood?: "idle" | "thinking" | "happy" | "sleepy" }) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
      <div className="bg-accent-grad pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl banner-glow" aria-hidden="true" />
      <div className="relative flex items-center gap-3">
        <Ember size={52} mood={mood} label="Ember, your Forge Copilot" />
        <div>
          <h1 className="text-grad text-3xl font-semibold tracking-tight">Copilot</h1>
          <p className="text-sm text-muted">{sub}</p>
        </div>
      </div>
    </header>
  );
}

const CAPS = [
  { icon: PenLine, title: "Write it up", body: "Rough notes in, a clear post or project write-up out. It never invents results: missing facts become [placeholders] for you." },
  { icon: Compass, title: "Find your people", body: "Recommends clubs and events on Forge that fit your field, interests and projects, with links." },
  { icon: Mic, title: "Prep for the room", body: "Career fairs, interviews, demo days: a 30-second pitch of your work and the questions to expect." },
];

// Shown until Copilot is switched on (an API key plus supabase/copilot.sql).
export function CopilotSoon() {
  return (
    <>
      <Header sub="Ember is your writing partner and STEM mentor, built into Forge. It's waking up soon." mood="sleepy" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CAPS.map((c, i) => (
          <motion.div key={c.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="grad-edge rounded-3xl border p-5 shadow-[var(--shadow)]">
            <span className="bg-accent-grad grid size-10 place-items-center rounded-xl text-on-accent"><c.icon className="size-5" /></span>
            <h2 className="mt-4 font-semibold">{c.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
          </motion.div>
        ))}
      </div>
      <p className="mt-6 rounded-3xl border border-dashed border-line-strong bg-surface/60 p-5 text-center text-sm text-muted">Copilot is switching on soon. We&apos;re finishing the last setup step.</p>
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

  const IDEAS = [
    { icon: Users, text: "Which clubs on Forge fit me best, and why?" },
    { icon: Lightbulb, text: `What should I build next in ${field || "my field"} to stand out?` },
    { icon: Mic, text: "Give me a 30-second pitch of my best project for a career fair." },
    { icon: FileText, text: "Turn these notes into a project post: " },
    { icon: BadgeCheck, text: "Review my headline and suggest a sharper one." },
    { icon: Compass, text: "Which upcoming events should I go to this month?" },
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

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <Header sub={`Hi ${first}, I'm Ember. Ask about your work, your field or what's on Forge. I only use what you tell me.`} mood={busy ? "thinking" : msgs.length ? "happy" : "idle"} />
      {!msgs.length && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {IDEAS.map((idea, i) => (
            <motion.button
              key={idea.text}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => (idea.text.endsWith(": ") ? setInput(idea.text) : void send(idea.text))}
              className="grad-edge group flex items-start gap-3 rounded-3xl border p-4 text-left text-sm shadow-[var(--shadow)] transition duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span className="bg-accent-grad grid size-9 shrink-0 place-items-center rounded-xl text-on-accent transition group-hover:scale-110"><idea.icon className="size-4" /></span>
              <span className="pt-1.5 text-text-2">{idea.text}</span>
            </motion.button>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-1 flex-col gap-4">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "user" ? (
                <p className="bg-accent-grad max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap text-on-accent">{m.content}</p>
              ) : (
                <div className="flex max-w-[92%] gap-3">
                  <Ember size={34} mood={busy && i === msgs.length - 1 ? "thinking" : "idle"} className="mt-0.5" />
                  <div className="rounded-3xl rounded-tl-md border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2 shadow-[var(--shadow)]">
                    <Lookups tools={m.tools} live={busy && i === msgs.length - 1} />
                    {m.content ? <Rich text={m.content} /> : m.tools?.length ? null : <span className="inline-flex gap-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.span key={d} className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
                    {m.proposals?.map((p) => <ProposalCard key={p.id} p={p} />)}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="glass sticky bottom-24 mt-4 flex items-end gap-2 rounded-3xl p-2 md:bottom-4">
        <label htmlFor="copilot-input" className="sr-only">Ask Copilot</label>
        <textarea
          id="copilot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          rows={1}
          maxLength={4000}
          placeholder="Ask Copilot anything about your work or field"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-faint"
        />
        {busy ? (
          <button type="button" onClick={stop} aria-label="Stop" className="grid size-11 place-items-center rounded-full border border-line text-text transition hover:bg-hover"><Square className="size-4 fill-current" /></button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Send" className="bg-accent-grad grid size-11 place-items-center rounded-full text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:-translate-y-px active:scale-90 disabled:opacity-40"><ArrowUp className="size-5" /></button>
        )}
      </form>
      {remaining !== null && <p className="mt-2 text-center text-xs text-faint">{remaining} Copilot {remaining === 1 ? "request" : "requests"} left today</p>}
    </div>
  );
}
