"use client";
import { Check, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TitleBlock } from "@/components/app/title-block";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { type HeroCell, type HeroPhase, heroRecord, stageTitle } from "@/lib/landing-demo";

// The hero's demo: the whole product in one card. The member asks their AI assistant in plain words,
// it drafts the result with its proof (the visitor's own line, once they type one) and sends it to
// whoever saw the work, they sign it, and someone who searched signed work asks to talk. Each Replay
// tells it for someone else (STORIES): a student's club, an analyst's manager, a teacher's department
// head, because the same record works for anyone who builds, with any tool. Every step is also a
// button, and the visitor can press Send, the signer's button and answer the request themselves. With
// reduced motion it simply shows the signed end. Example people and links; the page says so.
// Drawn like the app (docs/design/app.md): a plain sheet in ink, the draft dashed until it's signed,
// and a title block underneath that fills in as the story goes. Green only once a person has signed.
export function ProofStage({ build }: { build: string }) {
  const [replays, setReplays] = useState(0);
  return (
    <div id="hero-preview" className="relative mx-auto w-full max-w-[30rem] min-w-0">
      {/* Keyed on the build, so each new line starts the sequence again from "logged"; each Replay is the next story. */}
      <Stage key={`${build}:${replays}`} build={build} story={STORIES[replays % STORIES.length]} />
      <div className="mt-2 flex items-center justify-between gap-3 pl-1">
        <p className="min-w-0 text-xs text-faint">{build ? "Your build. The people and the company are examples." : "Example data"}</p>
        <button type="button" onClick={() => setReplays((n) => n + 1)} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><RotateCcw className="size-3.5" /> Replay</button>
      </div>
    </div>
  );
}

const STEPS = ["Your AI drafts it", "Someone who saw it signs", "Someone finds it"];
type Person = { initials: string; name: string; role: string };
type Story = { title?: string; cmd: string; read: string; proof: string[]; send: string; sent: string; signer: Person & { act: string; done: string }; finder: Person & { ask: string } };
// The first is the one the page opens on (and the visitor's own line uses); Replay moves through the rest.
const STORIES: Story[] = [
  { cmd: "add the line robot to my record", read: "Read your merged PR and the expo video", proof: ["github.com/you/linebot/pull/42", "youtu.be/fall-expo-run"],
    send: "Send to club", sent: "Sent to Rocketry Club", signer: { initials: "BC", name: "Ben Cho", role: "Officer, Rocketry Club", act: "Verify", done: "Verified" },
    finder: { initials: "CD", name: "Cara Diaz", role: "Acme Aerospace", ask: "Saw your signed work on Brazework. Free to talk about our robotics internship?" } },
  { title: "New pricing tiers cut churn 9%", cmd: "put my pricing analysis on my record", read: "Read the analysis you built in Claude and the pilot results", proof: ["claude.ai/share/q3-pricing", "pilot-results.xlsx"],
    send: "Ask Dana to sign", sent: "Sent to Dana Ruiz", signer: { initials: "DR", name: "Dana Ruiz", role: "Director of Product, your manager", act: "Sign", done: "Signed" },
    finder: { initials: "LP", name: "Leo Park", role: "Brightline Consulting", ask: "Saw your signed pricing work. Free to talk about our associate role?" } },
  { title: "Fractions unit lifted quiz scores 18%", cmd: "add my fractions unit to my record", read: "Read the unit plan you made with Claude and the class quiz scores", proof: ["docs.google.com/fractions-unit", "quiz-scores.csv"],
    send: "Ask Tom to sign", sent: "Sent to Tom Owens", signer: { initials: "TO", name: "Tom Owens", role: "Head of Math, your department", act: "Sign", done: "Signed" },
    finder: { initials: "MG", name: "Maria Gómez", role: "Riverside School District", ask: "Saw your signed unit. Would you walk our curriculum team through it?" } },
];
type Phase = HeroPhase;

function Stage({ build, story }: { build: string; story: Story }) {
  const CMD = story.cmd;
  const typedBy = 250 + CMD.length * 42;
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState(0);
  const [answer, setAnswer] = useState<"accepted" | "declined" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (ms: number, f: () => void) => setTimeout(f, reduce ? 0 : ms);

  // The loop: type the command, read the work, show the draft, send it, the officer signs, a company asks.
  useEffect(() => {
    timers.current = [
      // Typed at a person's pace; everything after waits for the last letter.
      ...Array.from(CMD, (_, i) => at(250 + i * 42, () => setTyped(i + 1))),
      at(typedBy + 150, () => setPhase("reading")),
      at(typedBy + 900, () => setPhase("draft")),
      at(typedBy + 2300, () => setPhase("sent")),
      at(typedBy + 2800, () => setStep((s) => Math.max(s, 2))),
      at(typedBy + 4600, () => setStep(3)),
    ];
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const after = (n: number) => { if (n >= 2) { setTyped(CMD.length); setPhase("sent"); } };
  const jump = (n: number) => { stop(); after(n); setStep(n); };
  const send = () => { stop(); setTyped(CMD.length); setPhase("sent"); timers.current = [at(500, () => setStep(2)), at(2300, () => setStep(3))]; };
  const verify = () => { stop(); after(2); setStep(2); timers.current = [at(1500, () => setStep(3))]; };
  const shown = reduce ? CMD.length : typed;

  const signed = step >= 2;
  // Only ever shown after the story has played in the browser, so the server never prints a date.
  const today = signed ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const record = heroRecord({ phase, step, signer: story.signer.name, finder: story.finder.role, today });

  return (
    <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface">
      <ol className="relative px-5 pt-5 pb-4">
        <Node n={1} at={step} label={STEPS[0]} onPick={jump}>
          {/* What the member types to their assistant, and what it reads. */}
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-text">
            <p className="flex items-start gap-2">
              <span aria-hidden="true" className="text-faint">&gt;</span>
              <span aria-hidden="true">{CMD.slice(0, shown)}{phase === "typing" && !reduce && <span className="ml-px inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-text" />}</span>
              <span className="sr-only">You ask your AI assistant: “{CMD}”.</span>
            </p>
            {phase !== "typing" && <p className="text-muted">⎿ {story.read}</p>}
          </div>
          {/* The draft it writes, with the proof, ready to send: dashed until someone signs it. */}
          <div className={cn("mt-2 rounded-lg border p-3 transition duration-500", signed ? "border-line" : "border-dashed border-line-strong", phase === "draft" || phase === "sent" ? "opacity-100" : "translate-y-1 opacity-0")} inert={phase === "typing" || phase === "reading"}>
            <p className="text-xs text-muted">{signed ? "Milestone" : "Draft"}</p>
            <p className="mt-0.5 text-[16px] leading-snug font-semibold tracking-tight break-words">{build ? stageTitle(build) : story.title ?? stageTitle(build)}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Evidence">
              {story.proof.map((e) => <li key={e} className="max-w-full truncate rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-text-2">{e}</li>)}
            </ul>
            <div className="mt-2.5 flex min-h-8 items-center">
              {phase === "sent"
                ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-2"><Check className="size-3.5" /> {story.sent}</span>
                : <button type="button" onClick={send} className="inline-flex h-8 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">{story.send}</button>}
            </div>
          </div>
        </Node>

        <Node n={2} at={step} label={STEPS[1]} onPick={jump}>
          <div className="flex items-center gap-3">
            <Av>{story.signer.initials}</Av>
            <p className="min-w-0 flex-1 text-sm leading-snug"><span className="font-medium">{story.signer.name}</span><span className="block text-muted">{story.signer.role}</span></p>
            {signed
              ? <span className="inline-flex h-8 shrink-0 items-center gap-1.5 text-xs font-semibold text-ok"><Seal size={18} /> {story.signer.done}</span>
              : <button type="button" onClick={verify} className="inline-flex h-8 shrink-0 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">{story.signer.act}</button>}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className={cn("text-xs text-muted transition-opacity duration-500", signed ? "opacity-100" : "opacity-0")}>On the record with their name and today&apos;s date.</p>
            <Signature drawn={signed} still={!!reduce} />
          </div>
        </Node>

        <Node n={3} at={step} label={STEPS[2]} onPick={jump} last>
          <div className={cn("transition duration-500", step >= 3 ? "opacity-100" : "translate-y-1 opacity-0")} inert={step < 3}>
            <div className="flex gap-3">
              <Av>{story.finder.initials}</Av>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug"><span className="font-medium">{story.finder.name}</span> <span className="text-muted">{story.finder.role}</span></p>
                <p className="mt-1 text-sm leading-snug text-text-2">{story.finder.ask}</p>
              </div>
            </div>
            <div className="mt-3 flex min-h-9 items-center gap-2 pl-11" aria-live="polite">
              {answer === null ? (
                <>
                  <button type="button" onClick={() => setAnswer("accepted")} className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition hover:opacity-90">Accept</button>
                  <button type="button" onClick={() => setAnswer("declined")} className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-medium transition hover:border-line-strong hover:bg-hover">Decline</button>
                </>
              ) : (
                <p className="text-sm text-text-2">{answer === "accepted" ? "You're talking. They only reached you because you said yes." : "Declined. They aren't told, and can't message you again."}</p>
              )}
            </div>
          </div>
        </Node>
      </ol>

      {/* Where the record stands, filling in as the story goes: the drawing's title block. */}
      <TitleBlock label="Where this record stands" cells={record.map(titleCell)} className="rounded-none border-x-0 border-b-0 bg-surface sm:grid" />
    </div>
  );
}

// A title block cell: the seal once it's on the record, a dashed ring while it waits, a quiet dash for "not yet".
function titleCell(c: HeroCell) {
  const value = c.tone === "ok" ? <span className="inline-flex items-center gap-1.5"><Seal size={14} />{c.value}</span>
    : c.tone === "waiting" ? <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-line-strong" />{c.value}</span>
    : c.tone === "empty" ? <><span aria-hidden="true" className="text-faint">—</span><span className="sr-only">{c.value}</span></>
    : c.value;
  return { label: c.label, value, tone: c.tone === "ok" ? ("ok" as const) : undefined };
}

// One step of the sequence: its number (a tick once it has happened) is a button that jumps there.
function Node({ n, at, label, onPick, last, children }: { n: number; at: number; label: string; onPick: (n: number) => void; last?: boolean; children: React.ReactNode }) {
  const done = at >= n;
  return (
    <li className={cn("relative flex gap-4", !last && "pb-5")}>
      {/* The line down to the next step fills in ink once that step has happened. */}
      {!last && <span aria-hidden="true" className="absolute top-[1.625rem] bottom-0 left-[0.8125rem] w-px -translate-x-1/2 bg-line"><span className={cn("block size-full origin-top bg-text transition-transform duration-700 ease-out", at > n ? "scale-y-100" : "scale-y-0")} /></span>}
      <button type="button" onClick={() => onPick(n)} aria-label={`Step ${n}: ${label}`} aria-current={at === n ? "step" : undefined}
        className={cn("relative z-10 grid size-[1.625rem] shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors duration-300", done ? "border-text bg-text text-surface" : "border-dashed border-line-strong bg-surface text-muted")}>
        {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </button>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 pt-0.5 text-xs font-medium text-muted">{label}</p>
        {children}
      </div>
    </li>
  );
}

function Av({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-2">{children}</span>;
}

// The officer's signature, drawn as it's given. One stroke, so it draws like a pen would.
function Signature({ drawn, still }: { drawn: boolean; still: boolean }) {
  return (
    <svg viewBox="0 0 132 44" aria-hidden="true" className="h-11 w-[8.25rem] shrink-0 text-text">
      <path pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        // A signer's flourish, not anyone's letters: every story's signer can have written it, then the underline.
        d="M6 30c6-1 9-15 15-17s3 13-2 17c5-6 10-11 14-10s-2 11 2 11 7-12 11-12-2 12 3 12 7-11 11-11-1 11 4 11 8-9 12-10-1 10 4 10 9-7 13-11M14 38c28-3 66-5 110-7"
        style={{ strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: still ? "none" : "stroke-dashoffset 1.1s cubic-bezier(0.6, 0, 0.3, 1) 0.15s" }} />
    </svg>
  );
}
