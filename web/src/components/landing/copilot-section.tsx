"use client";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { BadgeCheck, CalendarCheck, CalendarPlus, Check, ClipboardList, GitBranch, Megaphone, MessageSquare, MessageSquareText, ShieldCheck, UserPlus, Users, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Eyebrow, H2 } from "./marketing";
import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";

// Ember on the landing page, shown the way it really works (lib/copilot-agent.ts): you ask in plain
// words, it looks things up on Brazework with tools (each lookup shown as it runs), answers from what it
// found, and prepares actions as cards you confirm. It never saves anything on its own.

type Scenario = {
  id: string;
  tab: string;
  icon: typeof Users;
  ask: string;
  tools: string[];
  answer: string;
  card: { title: string; lines: string[]; confirm: string };
};

const SCENARIOS: Scenario[] = [
  {
    id: "meeting",
    tab: "Plan our next meeting",
    icon: CalendarPlus,
    ask: "Set up our general body meeting next Thursday and remind everyone.",
    tools: ["Reading your organization", "Checking the events calendar"],
    answer: "Thursday at 6 is open and doesn't clash with anything your members RSVP'd to. Here's the event, with a reminder to the chapter.",
    card: { title: "Host: General body meeting", lines: ["Thu 6:00 PM · Engineering Hall 210", "Announces to the chapter chat"], confirm: "Create event" },
  },
  {
    id: "club",
    tab: "Find my club",
    icon: Users,
    ask: "I'm into rockets and embedded systems. Which club should I join?",
    tools: ["Reading your profile", "Searching clubs", "Checking upcoming events"],
    answer: "Rocketry Club fits best: they build flight computers in-house, and their build night is Thursday at 7.",
    card: { title: "Join Rocketry Club", lines: ["42 members · Aerospace", "Next: Build night, Thu 7:00 PM"], confirm: "Join" },
  },
  {
    id: "meet",
    tab: "Meet the right person",
    icon: MessageSquare,
    ask: "Who's working on flight computers? I want to learn from them.",
    tools: ["Finding people", "Reading your profile"],
    answer: "Leo Park built the avionics for Rocketry Club's last two launches. Here's a short intro you can send him.",
    card: { title: "Message Leo Park", lines: ["\"Hi Leo, I saw your avionics work on the L2 launch. I'm building a flight computer too. Could I ask you a few questions?\""], confirm: "Send" },
  },
  {
    id: "update",
    tab: "Weekly club update",
    icon: Megaphone,
    ask: "Draft this week's update for Rocketry Club.",
    tools: ["Reading this week's club report", "Checking the verification queue"],
    answer: "This week: 6 new members, 14 posts (up from 9), and 2 milestones verified. Static fire is Saturday.",
    card: { title: "Post to Rocketry Club", lines: ["Uses only the report's numbers", "Also announces in Discord, if connected"], confirm: "Post" },
  },
];

// Everything Ember can do today (each is a real tool in lib/copilot-tools.ts).
const CAN = [
  { icon: Users, label: "Find and join clubs" },
  { icon: CalendarCheck, label: "RSVP to events" },
  { icon: UserPlus, label: "Follow people" },
  { icon: MessageSquare, label: "Message people" },
  { icon: GitBranch, label: "Import GitHub projects" },
  { icon: BadgeCheck, label: "Get milestones verified" },
  { icon: CalendarPlus, label: "Host club events" },
  { icon: ClipboardList, label: "Run weekly club reports" },
  { icon: Megaphone, label: "Post updates to Brazework and Discord" },
];

const HOW = [
  { icon: MessageSquareText, title: "Ask in plain words", body: "Write it like you'd text a teammate. No prompts to learn." },
  { icon: Wrench, title: "It checks real Brazework data", body: "Clubs, events, your profile, GitHub and club reports, through tools. You see every lookup." },
  { icon: ShieldCheck, title: "You approve every action", body: "Joining, posting or adding a project shows up as a card. Nothing happens until you tap." },
];

export function CopilotSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const reduce = useReducedMotion();
  const [pick, setPick] = useState(0);
  const s = SCENARIOS[pick];

  return (
    <section id="copilot" data-story="Ember, the AI agent" className="story-sec relative isolate scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div className="bg-accent-grad pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex justify-center"><Ember size={72} mood="happy" /></div>
          <Eyebrow className="mt-4">Ember · the AI agent inside Brazework</Eyebrow>
          <h2 className={`mt-5 ${H2}`}>An AI agent that runs <span className="text-grad">the busywork.</span></h2>
          <p className="m-hide mt-5 text-lg leading-relaxed text-muted">Ember works inside Brazework for officers and members. Ask it to plan the next meeting, draft the week&apos;s update, find the right person or add your project. It checks real data first, then does the work as a card you approve. It never invents results.</p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2" aria-label="What Ember can do">
            {CAN.map((c) => <li key={c.label} className="glass-card inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-2"><c.icon className="size-4 text-text" /> {c.label}</li>)}
          </ul>
        </div>

        <ol className="m-cards mx-auto mt-12 grid grid-cols-1 max-w-5xl gap-3 sm:grid-cols-3">
          {HOW.map((h, i) => (
            <li key={h.title} className="glass-card relative rounded-3xl p-5">
              <span className="absolute top-5 right-5 font-mono text-xs text-faint">0{i + 1}</span>
              <span className="nav-tile grid size-10 place-items-center rounded-xl text-text-2"><h.icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">{h.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{h.body}</p>
            </li>
          ))}
        </ol>

        <div ref={ref} className="mx-auto mt-10 max-w-3xl">
          <div role="tablist" aria-label="Example tasks" className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-3xl bg-surface-2 p-1">
            {SCENARIOS.map((sc, i) => (
              <button key={sc.id} type="button" role="tab" aria-selected={pick === i} onClick={() => setPick(i)} className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition", pick === i ? "text-on-accent" : "text-muted hover:text-text")}>
                {pick === i && <motion.span layoutId="ember-demo-tab" className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <sc.icon className="relative size-4" /> <span className="relative">{sc.tab}</span>
              </button>
            ))}
          </div>
          <div className="glass-card mt-4 rounded-[2rem] p-4 sm:p-6" aria-label={`Example: ${s.tab}`}>
            {/* Restart the run whenever the scenario changes (or it first scrolls into view). */}
            <Run key={`${s.id}-${inView}`} s={s} play={inView} reduce={!!reduce} />
          </div>
        </div>
      </div>
    </section>
  );
}

// One example run: question → lookups appear and tick off → the answer types → the action card.
function Run({ s, play, reduce }: { s: Scenario; play: boolean; reduce: boolean }) {
  const total = s.tools.length;
  const [step, setStep] = useState(reduce ? total + 1 : 0); // 0..total: tools done; total+1: answer
  const [n, setN] = useState(reduce ? s.answer.length : 0);
  const [choice, setChoice] = useState<"none" | "done" | "dismissed">("none");
  useEffect(() => {
    if (!play || reduce || step > total) return;
    const t = setTimeout(() => setStep((v) => v + 1), step === 0 ? 700 : 650);
    return () => clearTimeout(t);
  }, [play, reduce, step, total]);
  useEffect(() => {
    if (reduce || step <= total || n >= s.answer.length) return;
    const t = setTimeout(() => setN((v) => Math.min(s.answer.length, v + 3)), 22);
    return () => clearTimeout(t);
  }, [reduce, step, total, n, s.answer.length]);
  const answering = step > total;
  const typed = answering && n >= s.answer.length;

  return (
    <div className="min-h-[360px]">
      <div className="flex justify-end">
        <p className="bg-accent-grad max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-sm text-on-accent">{s.ask}</p>
      </div>
      <div className="mt-4 flex gap-3">
        <Ember size={36} mood={!typed ? "thinking" : choice === "done" ? "happy" : "idle"} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          {/* The lookups, as they run: the same steps the app shows. */}
          <ul className="flex flex-wrap gap-1.5" aria-label="What Ember checked">
            {s.tools.map((t, i) => {
              const state = step > i + 1 || answering ? "done" : step === i + 1 || (step === 0 && i === 0 && play) ? "live" : "wait";
              if (state === "wait") return null;
              return (
                <motion.li key={t} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", state === "done" ? "border-line text-muted" : "border-line-strong text-text")}>
                  {state === "done" ? <Check className="size-3 text-emerald-500" /> : <span className="size-1.5 animate-pulse rounded-full bg-text" />}
                  {t}
                </motion.li>
              );
            })}
          </ul>
          {answering && (
            <div className="glass-card mt-3 rounded-3xl rounded-tl-md px-4 py-3 text-sm leading-relaxed text-text-2">
              <span className="sr-only">{s.answer}</span>
              <span aria-hidden="true">{s.answer.slice(0, n)}{!typed && <motion.span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-accent" animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />}</span>
            </div>
          )}
          {/* The action, prepared but not taken: the member decides. */}
          <AnimatePresence>
            {typed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-dashed border-line-strong p-4">
                <div className="text-[11px] font-medium tracking-wide text-faint uppercase">Ember prepared this · waiting for you</div>
                <div className="mt-1.5 font-semibold">{s.card.title}</div>
                {s.card.lines.map((l) => <div key={l} className="text-sm text-muted">{l}</div>)}
                <div className="mt-3 flex items-center gap-2">
                  {choice === "none" ? (
                    <>
                      <button type="button" onClick={() => setChoice("done")} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent transition active:scale-95"><Check className="size-4" /> {s.card.confirm}</button>
                      <button type="button" onClick={() => setChoice("dismissed")} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition hover:bg-hover hover:text-text"><X className="size-4" /> Dismiss</button>
                    </>
                  ) : (
                    <span role="status" className="text-sm text-muted">{choice === "done" ? "Done. In the app, this runs the same action as doing it yourself." : "Dismissed. Nothing changed."}</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
